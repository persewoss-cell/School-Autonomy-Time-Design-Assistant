import bcrypt from "bcryptjs";
import { z } from "zod";
import { basicInfoSchema, type DesignDoc } from "@/domain/types";
import { validateDesign } from "@/validation/design";
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

export const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email("이메일 형식이 맞지 않습니다."),
  password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다.").max(100),
  name: z.string().trim().min(1, "이름을 입력해 주세요.").max(30),
  schoolName: z.string().trim().min(2, "학교명을 입력해 주세요.").max(40),
});

export type PublicUser = Pick<User, "id" | "email" | "name" | "schoolName" | "role" | "status">;
export const publicUser = (u: User): PublicUser => ({
  id: u.id,
  email: u.email,
  name: u.name,
  schoolName: u.schoolName,
  role: u.role,
  status: u.status,
});

/** 회원가입: ADMIN_EMAILS에 있는 이메일은 바로 관리자, 나머지는 관리자 승인 대기 */
export async function signup(repo: Repo, raw: unknown, adminEmails: string[]): Promise<User> {
  const r = signupSchema.safeParse(raw);
  if (!r.success) throw new ServiceError(400, r.error.issues[0].message);
  const { email, password, name, schoolName } = r.data;
  if (await repo.users.findByEmail(email)) throw new ServiceError(409, "이미 가입된 이메일입니다.");
  const isAdmin = adminEmails.includes(email);
  const user = await repo.users.create({
    email,
    passwordHash: await bcrypt.hash(password, 10),
    name,
    schoolName,
    role: isAdmin ? "admin" : "teacher",
    status: isAdmin ? "active" : "pending",
    createdAt: new Date(),
    lastLoginAt: null,
  });
  await repo.logs.add({ kind: "signup", userId: user.id, email });
  return user;
}

export async function login(repo: Repo, rawEmail: string, password: string): Promise<User> {
  const email = String(rawEmail ?? "").trim().toLowerCase();
  const user = await repo.users.findByEmail(email);
  if (!user || !(await bcrypt.compare(String(password ?? ""), user.passwordHash))) {
    await repo.logs.add({ kind: "login_fail", email });
    throw new ServiceError(401, "이메일 또는 비밀번호가 맞지 않습니다.");
  }
  if (user.status === "pending") throw new ServiceError(403, "관리자 승인을 기다리고 있습니다. 승인 후 로그인할 수 있어요.");
  if (user.status === "blocked") throw new ServiceError(403, "사용이 중지된 계정입니다. 관리자에게 문의하세요.");
  await repo.users.update(user.id, { lastLoginAt: new Date() });
  await repo.logs.add({ kind: "login", userId: user.id, email });
  return user;
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

function recordFields(doc: DesignDoc, fallbackSchool: string) {
  const issues = validateDesign(doc);
  return {
    doc,
    name: doc.basic.name.trim(),
    type: doc.basic.type,
    grade: doc.basic.grade,
    semester: doc.basic.semester,
    schoolName: doc.application.schoolName.trim() || fallbackSchool,
    schoolYear: doc.application.startYear.trim() || "2027",
    errorCount: issues.filter((i) => i.level === "error").length,
    warningCount: issues.filter((i) => i.level === "warning").length,
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
  const fields = recordFields(doc, user.schoolName);
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
  await repo.logs.add({ kind: "save", userId: user.id, email: user.email, designId: record.id, detail: fields.name });

  const duplicate =
    fields.type === "activity" && fields.name
      ? await repo.designs.findSameActivity(fields.schoolName, fields.schoolYear, fields.name, record.id)
      : null;
  const { doc: _doc, ...summary } = record;
  return { record: summary, duplicate };
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
  await repo.logs.add({ kind: "delete", userId: user.id, email: user.email, designId: id, detail: d.name });
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
  const [users, designs, logs] = await Promise.all([repo.users.list(), repo.designs.listAll(), repo.logs.list(500)]);
  const count = <T,>(xs: T[], key: (x: T) => string) =>
    xs.reduce<Record<string, number>>((acc, x) => {
      const k = key(x);
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {});
  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
  const recent = logs.filter((l) => l.createdAt.getTime() > weekAgo);
  const saves = recent.filter((l) => l.kind === "save").length;
  const parseFails = recent.filter((l) => l.kind === "parse_fail");
  return {
    users: { total: users.length, pending: users.filter((u) => u.status === "pending").length, byStatus: count(users, (u) => u.status) },
    designs: {
      total: designs.length,
      byType: count(designs, (d) => (d.type === "subject" ? "과목" : "활동")),
      byGrade: count(designs, (d) => `${d.grade}학년`),
      complete: designs.filter((d) => d.errorCount === 0).length,
      bySchool: count(designs, (d) => d.schoolName || "(학교 미입력)"),
    },
    week: {
      saves,
      downloads: recent.filter((l) => l.kind === "download").length,
      logins: recent.filter((l) => l.kind === "login").length,
      parseFails: parseFails.length,
      parseFailByStep: count(parseFails, (l) => (l.detail ?? "").split(":")[0] || "기타"),
    },
  };
}
