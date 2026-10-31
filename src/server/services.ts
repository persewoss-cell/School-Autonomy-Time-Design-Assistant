import bcrypt from "bcryptjs";
import { z } from "zod";
import { basicInfoSchema, type DesignDoc, type Grade } from "@/domain/types";
import { REGION_VALUES } from "@/domain/regions";
import { checklistResults, validateDesign, withoutDismissed } from "@/validation/design";
import { checkBasicHours, sameSemesterOthers, type SemesterOthers } from "@/validation/hours";
import { bandStatus, checkKey, isViewGrade, type Checks, type HourCheck } from "@/domain/hoursView";
import type { DesignRecord, DesignSummary, Repo, User } from "./repo";

/** 서비스 계층: 로그인·저장·권한 규칙. 저장소(repo)만 바꾸면 테스트할 수 있다. */

export class ServiceError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}


/** 학교명: 띄어쓰기 없이 저장하고, 중복 확인·로그인에 쓴다 */
export const schoolKeyOf = (name: string) => String(name ?? "").replace(/\s+/g, "");

const schoolNameSchema = z
  .string()
  .transform(schoolKeyOf)
  .pipe(
    z
      .string()
      .min(1, "학교명을 입력해 주세요.")
      .max(40, "학교명이 너무 깁니다.")
      .regex(/^[가-힣0-9]+초등학교$/, "학교명은 정식 명칭으로 입력해 주세요. 예: 광양중동초등학교 (○○초 X)"),
  );

const passwordSchema = z.string().min(8, "비밀번호는 8자 이상이어야 합니다.").max(100, "비밀번호가 너무 깁니다.");

export const signupSchema = z
  .object({
    region: z.string().refine((v) => REGION_VALUES.includes(v), "지역(시·군·구)을 골라 주세요."),
    schoolName: schoolNameSchema,
    password: passwordSchema,
    passwordConfirm: z.string(),
  })
  .refine((v) => v.password === v.passwordConfirm, { message: "비밀번호와 비밀번호 확인이 서로 다릅니다.", path: ["passwordConfirm"] });

export type PublicUser = Pick<User, "id" | "region" | "schoolName" | "role" | "status" | "mustChangePassword">;
export const publicUser = (u: User): PublicUser => ({
  id: u.id,
  region: u.region,
  schoolName: u.schoolName,
  role: u.role,
  status: u.status,
  mustChangePassword: !!u.mustChangePassword,
});

/** 회원가입 신청: 한 학교당 1계정. ADMIN_SCHOOLS에 있는 학교는 바로 관리자, 나머지는 관리자 승인 대기 */
export async function signup(repo: Repo, raw: unknown, adminSchools: string[]): Promise<User> {
  const r = signupSchema.safeParse(raw);
  if (!r.success) throw new ServiceError(400, r.error.issues[0].message);
  const { region, schoolName, password } = r.data;
  if (await repo.users.findBySchoolKey(schoolName)) {
    throw new ServiceError(409, "이미 가입된 학교입니다. 한 학교당 1개의 계정만 쓸 수 있어요. 비밀번호를 잊었다면 로그인 화면에서 재설정을 신청하세요.");
  }
  const isAdmin = adminSchools.map(schoolKeyOf).includes(schoolName);
  const user = await repo.users.create({
    region,
    schoolName,
    schoolKey: schoolName,
    passwordHash: await bcrypt.hash(password, 10),
    role: isAdmin ? "admin" : "teacher",
    status: isAdmin ? "active" : "pending",
    mustChangePassword: false,
    resetRequest: null,
    createdAt: new Date(),
    lastLoginAt: null,
  });
  await repo.logs.add({ kind: "signup", userId: user.id, school: schoolName, detail: region });
  return user;
}

/** 로그인: 학교명 + 비밀번호 */
export async function login(repo: Repo, rawSchool: string, password: string): Promise<User> {
  const key = schoolKeyOf(rawSchool);
  const user = key ? await repo.users.findBySchoolKey(key) : null;
  if (!user || !(await bcrypt.compare(String(password ?? ""), user.passwordHash))) {
    await repo.logs.add({ kind: "login_fail", school: key });
    throw new ServiceError(401, "학교명 또는 비밀번호가 맞지 않습니다.");
  }
  if (user.status === "pending") throw new ServiceError(403, "관리자 승인을 기다리고 있습니다. 승인 후 로그인할 수 있어요.");
  if (user.status === "blocked") throw new ServiceError(403, "사용이 중지된 계정입니다. 관리자에게 문의하세요.");
  await repo.users.update(user.id, { lastLoginAt: new Date() });
  await repo.logs.add({ kind: "login", userId: user.id, school: user.schoolName });
  return user;
}

/** 비밀번호를 잊은 학교의 재설정 신청 (관리자가 임시 비밀번호를 발급해 연락처로 알려 줌) */
export async function requestPasswordReset(repo: Repo, rawSchool: string, rawContact: string): Promise<void> {
  const key = schoolKeyOf(rawSchool);
  const contact = String(rawContact ?? "").trim().slice(0, 100);
  if (!key) throw new ServiceError(400, "학교명을 입력해 주세요.");
  if (!contact) throw new ServiceError(400, "임시 비밀번호를 받을 연락처(예: 교무실 전화번호)를 입력해 주세요.");
  const user = await repo.users.findBySchoolKey(key);
  // 가입 여부를 알려 주지 않도록, 없는 학교여도 같은 답을 준다
  if (user) await repo.users.update(user.id, { resetRequest: { requestedAt: new Date(), contact } });
  await repo.logs.add({ kind: "reset_request", userId: user?.id, school: key, detail: user ? "요청 접수" : "가입되지 않은 학교" });
}

/** 관리자: 임시 비밀번호 발급 (한 번만 보여 줌, 다음 로그인 때 새 비밀번호로 바꾸게 함) */
export async function resetPasswordByAdmin(repo: Repo, admin: User, targetId: string): Promise<string> {
  if (admin.role !== "admin") throw new ServiceError(403, "관리자만 할 수 있습니다.");
  const target = await repo.users.findById(targetId);
  if (!target) throw new ServiceError(404, "계정을 찾을 수 없습니다.");
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  const temp = Array.from(bytes, (b) => chars[b % chars.length]).join("");
  await repo.users.update(targetId, { passwordHash: await bcrypt.hash(temp, 10), mustChangePassword: true, resetRequest: null });
  await repo.logs.add({ kind: "password_reset", userId: targetId, school: target.schoolName, detail: `관리자(${admin.schoolName})가 임시 비밀번호 발급` });
  return temp;
}

/** 로그인한 학교가 비밀번호 바꾸기 */
export async function changePassword(repo: Repo, user: User, raw: unknown): Promise<void> {
  const r = z
    .object({ current: z.string(), password: passwordSchema, passwordConfirm: z.string() })
    .refine((v) => v.password === v.passwordConfirm, { message: "새 비밀번호와 비밀번호 확인이 서로 다릅니다." })
    .safeParse(raw);
  if (!r.success) throw new ServiceError(400, r.error.issues[0].message);
  if (!(await bcrypt.compare(r.data.current, user.passwordHash))) throw new ServiceError(400, "지금 비밀번호가 맞지 않습니다.");
  await repo.users.update(user.id, { passwordHash: await bcrypt.hash(r.data.password, 10), mustChangePassword: false });
  await repo.logs.add({ kind: "password_change", userId: user.id, school: user.schoolName });
}

/** 저장할 설계 문서의 최소 형식 확인 (나머지는 화면에서 점검) */
const designDocSchema = z
  .object({
    version: z.literal(1),
    basic: basicInfoSchema.partial({ name: true }).extend({ name: z.string().max(40) }),
    input: z.object({}).passthrough(),
    areas: z.array(z.object({}).passthrough()).max(10),
    standards: z.array(z.object({}).passthrough()).max(60),
    application: z.object({ schoolName: z.string().max(40) }).passthrough(),
  })
  .passthrough();

function recordFields(doc: DesignDoc, fallbackSchool: string, others: SemesterOthers = []) {
  const ctx = { semesterOthers: others };
  const issues = validateDesign(doc, ctx);
  return {
    doc,
    name: doc.basic.name.trim(),
    type: doc.basic.type,
    grade: doc.basic.grade,
    semester: doc.basic.semester,
    hours: doc.basic.hours,
    subjectGroup: doc.basic.subjectGroup,
    schoolName: doc.application.schoolName.trim() || fallbackSchool,
    schoolYear: doc.application.startYear.trim() || "2027",
    errorCount: issues.filter((i) => i.level === "error").length,
    warningCount: issues.filter((i) => i.level === "warning").length,
    hoursWarnings: issues.filter((i) => i.level === "warning" && i.field === "운영 시수").length,
    dismissed: doc.dismissed ?? [],
    checklistLeft: checklistResults(doc, ctx).filter((c) => !c.ok).length,
    progress: doc.progress ?? null,
  };
}

export interface SaveResult {
  record: DesignSummary;
  /** 같은 학교·같은 학년도에 같은 활동명이 있으면 그 설계 */
  duplicate: DesignSummary | null;
}

export async function saveDesign(repo: Repo, user: User, rawDoc: unknown, id?: string): Promise<SaveResult> {
  if (JSON.stringify(rawDoc ?? null).length > 1_000_000) throw new ServiceError(413, "문서가 너무 큽니다.");
  const parsed = designDocSchema.safeParse(rawDoc);
  if (!parsed.success) throw new ServiceError(400, "설계 문서 형식이 올바르지 않습니다.");
  const doc = rawDoc as DesignDoc;
  const mine = await repo.designs.listByOwner(user.id);
  const others = sameSemesterOthers({ id, grade: doc.basic.grade, semester: doc.basic.semester, schoolYear: doc.application.startYear.trim() }, mine);
  const fields = recordFields(doc, user.schoolName, others);
  const now = new Date();

  let record: DesignRecord;
  if (id) {
    const existing = await repo.designs.get(id);
    if (!existing) throw new ServiceError(404, "설계를 찾을 수 없습니다.");
    if (existing.ownerId !== user.id) throw new ServiceError(403, "내 설계만 고칠 수 있습니다.");
    await repo.designs.update(id, { ...fields, updatedAt: now });
    record = { ...existing, ...fields, updatedAt: now };
  } else {
    record = await repo.designs.create({ ownerId: user.id, ...fields, createdAt: now, updatedAt: now });
  }
  await repo.designs.saveVersion(record.id, doc);
  await repo.logs.add({ kind: "save", userId: user.id, school: user.schoolName, designId: record.id, detail: fields.name });
  if (user.actingAdmin) await adminLog(repo, user, `관리자 수정: ${user.schoolName} 「${fields.name}」`, record.id);

  const duplicate =
    fields.name
      ? await repo.designs.findSameActivity(fields.schoolName, fields.schoolYear, fields.name, record.id)
      : null;
  const { doc: _doc, ...summary } = record;
  return { record: summary, duplicate };
}

/**
 * '운영 시수' 경고는 같은 학기의 다른 설계에 따라 달라진다 (예: 17차시 설계 뒤에 12차시 설계를 만들면 둘 다 경고 없음).
 * 저장할 때의 수 대신 지금 목록 기준으로 다시 센다.
 */
function withLiveHoursWarnings(list: DesignSummary[]): DesignSummary[] {
  return list.map((d) => {
    if (typeof d.hours !== "number") return d;
    const basic = { grade: d.grade as Grade, hours: d.hours, type: d.type };
    const warn = (others: SemesterOthers) => withoutDismissed(checkBasicHours(basic, others), d.dismissed).filter((i) => i.level === "warning").length;
    const stored = d.hoursWarnings ?? warn([]); // 예전 저장본은 같은 학기 설계를 모르고 셌음
    const live = warn(sameSemesterOthers(d, list));
    return { ...d, warningCount: Math.max(0, d.warningCount - stored + live), hoursWarnings: live };
  });
}

/** 내 설계 목록 (예전 저장본은 운영 시수를 문서에서 채움) */
export async function listMyDesigns(repo: Repo, user: User): Promise<DesignSummary[]> {
  return withLiveHoursWarnings(await fillLegacy(repo, await repo.designs.listByOwner(user.id)));
}

/** 예전 저장본에 없는 운영 시수·편성 교과를 문서에서 채운다 (시수 점검 비교에 필요) */
async function fillLegacy(repo: Repo, list: DesignSummary[]): Promise<DesignSummary[]> {
  return Promise.all(
    list.map(async (d) => {
      if (typeof d.hours === "number" && d.subjectGroup) return d;
      const full = await repo.designs.get(d.id);
      return { ...d, hours: full?.doc.basic.hours ?? 0, subjectGroup: full?.doc.basic.subjectGroup };
    }),
  );
}

/** 학교의 시수 점검 화면 저장본 (학년 화면별) */
export async function listHourChecks(repo: Repo, user: User): Promise<{ grade: number; data: unknown; updatedAt: Date }[]> {
  return (await repo.hourChecks.listByOwner(user.id)).map(({ grade, data, updatedAt }) => ({ grade, data, updatedAt }));
}

const hourCheckSchema = z
  .object({
    grade: z.number().int().min(3).max(6),
    schoolYear: z.number().int().min(2000).max(2100),
    input: z
      .object({
        band: z.enum(["3-4", "5-6"]),
        baseHours: z.record(z.string(), z.number()),
        creativeBaseHours: z.number(),
        subjectHours: z.record(z.string(), z.array(z.number()).length(4)),
        creativeHours: z.array(z.number()).length(4),
        courses: z
          .array(
            z.object({
              name: z.string().max(60),
              subjectKey: z.string().max(10),
              semester: z.number().int().min(0).max(3),
              hours: z.number().int().min(0).max(200),
              designId: z.string().max(40).optional(),
            }),
          )
          .max(20),
      })
      .passthrough(),
  })
  .passthrough();

/** 시수 점검 화면 저장 (학년 화면 하나) */
export async function saveHourCheck(repo: Repo, user: User, grade: number, raw: unknown): Promise<void> {
  const r = hourCheckSchema.safeParse(raw);
  if (!r.success || r.data.grade !== grade) throw new ServiceError(400, "시수 점검 내용 형식이 올바르지 않습니다.");
  await repo.hourChecks.upsert({ ownerId: user.id, grade, schoolYear: r.data.schoolYear, data: r.data, updatedAt: new Date() });
}

/** 설계 열기: 본인 것 또는 관리자 */
export async function getDesign(repo: Repo, user: User, id: string): Promise<DesignRecord> {
  const d = await repo.designs.get(id);
  if (!d) throw new ServiceError(404, "설계를 찾을 수 없습니다.");
  if (d.ownerId !== user.id && user.role !== "admin") throw new ServiceError(403, "볼 수 없는 설계입니다.");
  return d;
}

export async function deleteDesign(repo: Repo, user: User, id: string): Promise<void> {
  const d = await repo.designs.get(id);
  if (!d) throw new ServiceError(404, "설계를 찾을 수 없습니다.");
  if (d.ownerId !== user.id) throw new ServiceError(403, "내 설계만 삭제할 수 있습니다.");
  await repo.designs.delete(id);
  await repo.logs.add({ kind: "delete", userId: user.id, school: user.schoolName, designId: id, detail: d.name });
  if (user.actingAdmin) await adminLog(repo, user, `관리자 삭제: ${user.schoolName} 「${d.name}」`, id);
}

/** 관리자 작업 기록 (학교로 들어가 고친 것 포함) */
async function adminLog(repo: Repo, user: User, detail: string, designId?: string) {
  const admin = user.actingAdmin ?? { id: user.id, schoolName: user.schoolName };
  await repo.logs.add({ kind: "admin", userId: admin.id, school: admin.schoolName, designId, detail });
}

/** 관리자: 아무 학교의 설계 삭제 */
export async function deleteDesignByAdmin(repo: Repo, admin: User, id: string): Promise<void> {
  const d = await repo.designs.get(id);
  if (!d) throw new ServiceError(404, "설계를 찾을 수 없습니다.");
  await repo.designs.delete(id);
  await adminLog(repo, admin, `관리자 삭제: ${d.schoolName} 「${d.name}」`, id);
}

/** 관리자: 학교 계정 삭제 (그 학교의 설계·시수 점검도 함께, 이용 기록은 남김). 자기 자신은 못 지움 */
export async function deleteUserByAdmin(repo: Repo, admin: User, targetId: string): Promise<{ designs: number }> {
  if (targetId === admin.id) throw new ServiceError(400, "자기 자신의 계정은 지울 수 없습니다.");
  const target = await repo.users.findById(targetId);
  if (!target) throw new ServiceError(404, "학교를 찾을 수 없습니다.");
  const designs = await repo.designs.deleteByOwner(targetId);
  await repo.hourChecks.deleteByOwner(targetId);
  await repo.users.delete(targetId);
  await adminLog(repo, admin, `계정 삭제: ${target.schoolName} (설계 ${designs}개 함께 삭제)`);
  return { designs };
}

/** 관리자 전체 설계 목록: 학교명과 그 학년도 학년군의 시수 점검 완료 여부를 붙인다 */
export async function listAllDesignsForAdmin(repo: Repo) {
  const [all, users] = await Promise.all([repo.designs.listAll(), repo.users.list()]);
  const designs = await fillLegacy(repo, all);
  const owner = new Map(users.map((u) => [u.id, u]));
  const byOwner = new Map<string, DesignSummary[]>();
  for (const d of designs) byOwner.set(d.ownerId, [...(byOwner.get(d.ownerId) ?? []), d]);
  const out = [];
  // 학교별 시수 점검은 한꺼번에 불러온다
  const owners = [...byOwner.keys()];
  const checkLists = new Map(await Promise.all(owners.map(async (id) => [id, await repo.hourChecks.listByOwner(id)] as const)));
  for (const [ownerId, list] of byOwner) {
    const checks: Checks = {};
    for (const c of checkLists.get(ownerId) ?? []) {
      const data = c.data as HourCheck | undefined;
      if (data?.schoolYear && isViewGrade(c.grade)) checks[checkKey(data.schoolYear, c.grade)] = data;
    }
    for (const d of withLiveHoursWarnings(list)) {
      const u = owner.get(ownerId);
      out.push({
        ...d,
        owner: u ? u.schoolName : "(삭제된 학교)",
        ownerRegion: u?.region ?? "",
        hoursComplete: bandStatus(d.grade, Number(d.schoolYear) || 2027, checks, list).complete,
      });
    }
  }
  return out.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

/** 관리자: 사용자 상태·권한 바꾸기 (자기 자신은 못 바꿈) */
export async function updateUserByAdmin(
  repo: Repo,
  admin: User,
  targetId: string,
  patch: { status?: User["status"]; role?: User["role"] },
): Promise<void> {
  if (admin.role !== "admin") throw new ServiceError(403, "관리자만 할 수 있습니다.");
  if (targetId === admin.id) throw new ServiceError(400, "자기 자신의 상태나 권한은 바꿀 수 없습니다.");
  const target = await repo.users.findById(targetId);
  if (!target) throw new ServiceError(404, "사용자를 찾을 수 없습니다.");
  const clean: Partial<User> = {};
  if (patch.status && ["pending", "active", "blocked"].includes(patch.status)) clean.status = patch.status;
  if (patch.role && ["teacher", "admin"].includes(patch.role)) clean.role = patch.role;
  await repo.users.update(targetId, clean);
}

/** 관리자 대시보드 통계 */
export async function adminStats(repo: Repo) {
  const [users, designs] = await Promise.all([repo.users.list(), repo.designs.listAll()]);
  const count = <T,>(xs: T[], key: (x: T) => string) =>
    xs.reduce<Record<string, number>>((acc, x) => {
      const k = key(x);
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {});
  const complete = designs.filter((d) => d.errorCount === 0).length;
  return {
    users: {
      total: users.length,
      pending: users.filter((u) => u.status === "pending").length,
      resetRequests: users.filter((u) => u.resetRequest).length,
      byRegion: count(users, (u) => u.region || "(지역 없음)"),
    },
    designs: {
      total: designs.length,
      complete,
      inProgress: designs.length - complete,
      byType: count(designs, (d) => (d.type === "subject" ? "과목" : "활동")),
      byGrade: count(designs, (d) => `${d.grade}학년`),
      bySchool: count(designs, (d) => d.schoolName || "(학교 미입력)"),
    },
  };
}

// ───────────── 예시안 파일 (관리자가 올리고 누구나 내려받음) ─────────────
/** Vercel 서버 함수가 받을 수 있는 요청 크기(약 4.5MB) 안으로 */
export const EXAMPLE_MAX_BYTES = 4 * 1024 * 1024;
const EXAMPLE_EXTS = ["hwp", "hwpx", "docx", "pdf"];

const exampleMetaSchema = z.object({
  schoolYear: z.string().trim().regex(/^\d{4}$/, "학년도는 2027처럼 네 자리 숫자로 적어 주세요."),
  type: z.enum(["subject", "activity"]),
  grade: z.coerce.number().int().min(3).max(6),
  semester: z.coerce.number().int().min(1).max(2),
  name: z.string().trim().min(1, "과목·활동 이름을 적어 주세요.").max(60),
});

export async function listExamples(repo: Repo) {
  return repo.examples.list();
}

export async function uploadExample(repo: Repo, admin: User, raw: unknown, file: { name: string; type: string; data: Buffer }) {
  const r = exampleMetaSchema.safeParse(raw);
  if (!r.success) throw new ServiceError(400, r.error.issues[0]?.message ?? "입력값을 확인해 주세요.");
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!EXAMPLE_EXTS.includes(ext)) throw new ServiceError(400, "한글(hwp·hwpx), docx, pdf 파일만 올릴 수 있어요.");
  if (file.data.length === 0) throw new ServiceError(400, "빈 파일입니다.");
  if (file.data.length > EXAMPLE_MAX_BYTES) throw new ServiceError(413, "파일이 너무 커요. 4MB 이하로 올려 주세요.");
  const meta = await repo.examples.create(
    { ...r.data, fileName: file.name.slice(0, 120), contentType: file.type || "application/octet-stream", size: file.data.length, uploadedAt: new Date() },
    file.data,
  );
  await repo.logs.add({ kind: "admin", userId: admin.id, school: admin.schoolName, detail: `예시안 올림: ${meta.name}` });
  return meta;
}

export async function deleteExample(repo: Repo, admin: User, id: string) {
  await repo.examples.delete(id);
  await repo.logs.add({ kind: "admin", userId: admin.id, school: admin.schoolName, detail: `예시안 삭제: ${id}` });
}

// ───────────── 관리자: 학교 일괄·개별 등록 ─────────────
export interface BulkRow {
  region: unknown;
  schoolName: unknown;
  password: unknown;
}
export interface BulkResult {
  row: number;
  schoolName: string;
  ok: boolean;
  message: string;
}

/**
 * 관리자가 학교 계정을 한꺼번에(또는 하나) 만든다. 바로 '사용 중'.
 * 줄마다 따로 검사해 되는 것은 만들고, 안 되는 줄은 이유를 돌려준다. (한 번에 최대 500개)
 */
export async function createUsersByAdmin(repo: Repo, admin: User, rows: BulkRow[]): Promise<BulkResult[]> {
  if (!Array.isArray(rows) || rows.length === 0) throw new ServiceError(400, "등록할 학교가 없습니다.");
  if (rows.length > 500) throw new ServiceError(400, "한 번에 500개까지 등록할 수 있어요.");
  const seen = new Set<string>();
  const out: BulkResult[] = [];
  for (const [i, raw] of rows.entries()) {
    const password = String(raw.password ?? "");
    const r = signupSchema.safeParse({ region: String(raw.region ?? "").trim(), schoolName: String(raw.schoolName ?? ""), password, passwordConfirm: password });
    const name = schoolKeyOf(String(raw.schoolName ?? ""));
    if (!r.success) {
      out.push({ row: i + 1, schoolName: name, ok: false, message: r.error.issues[0].message });
      continue;
    }
    if (seen.has(r.data.schoolName)) {
      out.push({ row: i + 1, schoolName: name, ok: false, message: "파일 안에 같은 학교가 두 번 있습니다." });
      continue;
    }
    seen.add(r.data.schoolName);
    if (await repo.users.findBySchoolKey(r.data.schoolName)) {
      out.push({ row: i + 1, schoolName: name, ok: false, message: "이미 가입된 학교입니다." });
      continue;
    }
    await repo.users.create({
      region: r.data.region,
      schoolName: r.data.schoolName,
      schoolKey: r.data.schoolName,
      passwordHash: await bcrypt.hash(r.data.password, 10),
      role: "teacher",
      status: "active",
      mustChangePassword: false,
      resetRequest: null,
      createdAt: new Date(),
      lastLoginAt: null,
    });
    out.push({ row: i + 1, schoolName: name, ok: true, message: "등록됨" });
  }
  const made = out.filter((x) => x.ok).length;
  if (made) await adminLog(repo, admin, `학교 등록: ${made}개 (${out.filter((x) => x.ok).map((x) => x.schoolName).slice(0, 5).join(", ")}${made > 5 ? " 외" : ""})`);
  return out;
}
