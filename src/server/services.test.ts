import { describe, expect, it } from "vitest";
import { sampleSubject } from "@/domain/sample";
import { memoryRepo } from "./repo";
import {
  listMyDesigns,
  adminStats,
  changePassword,
  deleteDesign,
  getDesign,
  login,
  requestPasswordReset,
  resetPasswordByAdmin,
  saveDesign,
  signup,
  updateUserByAdmin,
  uploadExample,
  deleteExample,
  listExamples,
  deleteUserByAdmin,
  deleteDesignByAdmin,
  listAllDesignsForAdmin,
} from "./services";
import { createSessionToken, readSessionToken } from "./session";

const SECRET = "test-secret-test-secret-test-secret-123";
const school = (schoolName: string, region = "광양시") => ({ region, schoolName, password: "password1", passwordConfirm: "password1" });
const ADMIN_SCHOOLS = ["광양중동초등학교"];

async function setup() {
  const repo = memoryRepo();
  const admin = await signup(repo, school("광양중동초등학교"), ADMIN_SCHOOLS);
  const t = await signup(repo, school("광양 마동 초등학교"), ADMIN_SCHOOLS);
  return { repo, admin, t };
}

describe("회원가입 (학교 단위)", () => {
  it("관리자 학교는 바로 관리자, 나머지는 승인 대기. 학교명 띄어쓰기는 없앰", async () => {
    const { admin, t } = await setup();
    expect([admin.role, admin.status]).toEqual(["admin", "active"]);
    expect([t.role, t.status, t.schoolName, t.region]).toEqual(["teacher", "pending", "광양마동초등학교", "광양시"]);
  });
  it("같은 학교는 다시 가입 신청 불가 (띄어쓰기만 달라도)", async () => {
    const { repo } = await setup();
    await expect(signup(repo, school("광양마동초등학교", "서구"), [])).rejects.toThrow("이미 가입된 학교");
  });
  it("정식 명칭이 아니면 거부", async () => {
    const { repo } = await setup();
    await expect(signup(repo, school("광양중동초"), [])).rejects.toThrow("정식 명칭");
  });
  it("비밀번호 확인이 다르거나 짧으면 거부, 지역은 전남·광주만", async () => {
    const { repo } = await setup();
    await expect(signup(repo, { ...school("순천남산초등학교"), passwordConfirm: "password2" }, [])).rejects.toThrow("서로 다릅니다");
    await expect(signup(repo, { ...school("순천남산초등학교"), password: "short", passwordConfirm: "short" }, [])).rejects.toThrow("8자");
    await expect(signup(repo, school("순천남산초등학교", "강남구"), [])).rejects.toThrow("지역");
    await expect(signup(repo, school("순천남산초등학교", "전남 순천시"), [])).rejects.toThrow("시·군·구");
    expect((await signup(repo, school("순천남산초등학교", "순천시"), [])).region).toBe("순천시");
  });
});

describe("로그인 (학교명 + 비밀번호)", () => {
  it("승인 전에는 로그인 불가, 승인 후 가능", async () => {
    const { repo, admin, t } = await setup();
    await expect(login(repo, "광양마동초등학교", "password1")).rejects.toThrow("승인");
    await updateUserByAdmin(repo, admin, t.id, { status: "active" });
    expect((await login(repo, " 광양 마동초등학교 ", "password1")).id).toBe(t.id);
  });
  it("비밀번호가 틀리면 실패 (원문 저장 안 함)", async () => {
    const { repo } = await setup();
    await expect(login(repo, "광양중동초등학교", "wrong-pass")).rejects.toThrow("맞지 않습니다");
    const u = await repo.users.findBySchoolKey("광양중동초등학교");
    expect(u!.passwordHash).not.toContain("password1");
  });
  it("관리자는 자기 자신을 못 바꾸고, 학교 계정은 관리 기능 불가", async () => {
    const { repo, admin, t } = await setup();
    await expect(updateUserByAdmin(repo, admin, admin.id, { role: "teacher" })).rejects.toThrow("자기 자신");
    await expect(updateUserByAdmin(repo, t, admin.id, { status: "blocked" })).rejects.toThrow("관리자만");
  });
});

describe("비밀번호 재설정", () => {
  it("신청 → 관리자가 임시 비밀번호 발급 → 임시 비밀번호로 로그인 → 새 비밀번호로 변경", async () => {
    const { repo, admin, t } = await setup();
    await updateUserByAdmin(repo, admin, t.id, { status: "active" });
    await requestPasswordReset(repo, "광양마동초등학교", "061-000-0000");
    expect((await repo.users.findById(t.id))!.resetRequest?.contact).toBe("061-000-0000");

    const temp = await resetPasswordByAdmin(repo, admin, t.id);
    expect(temp).toHaveLength(10);
    await expect(login(repo, "광양마동초등학교", "password1")).rejects.toThrow("맞지 않습니다");
    const u = await login(repo, "광양마동초등학교", temp);
    expect(u.mustChangePassword).toBe(true);
    expect(u.resetRequest).toBeNull();

    await expect(changePassword(repo, u, { current: temp, password: "newpass12", passwordConfirm: "newpass13" })).rejects.toThrow("서로 다릅니다");
    await changePassword(repo, u, { current: temp, password: "newpass12", passwordConfirm: "newpass12" });
    expect((await login(repo, "광양마동초등학교", "newpass12")).mustChangePassword).toBe(false);
  });
  it("없는 학교여도 같은 방식으로 답함 (가입 여부 노출 안 함), 연락처는 필수", async () => {
    const { repo, admin } = await setup();
    await expect(requestPasswordReset(repo, "없는초등학교", "010")).resolves.toBeUndefined();
    await expect(requestPasswordReset(repo, "광양중동초등학교", " ")).rejects.toThrow("연락처");
    await expect(resetPasswordByAdmin(repo, { ...admin, role: "teacher" }, admin.id)).rejects.toThrow("관리자만");
  });
});

describe("세션 토큰", () => {
  it("서명 확인, 다른 키나 변조는 거부", async () => {
    const token = await createSessionToken("u1", SECRET);
    expect(await readSessionToken(token, SECRET)).toBe("u1");
    expect(await readSessionToken(token, SECRET + "x")).toBeNull();
    expect(await readSessionToken(token.slice(0, -2) + "aa", SECRET)).toBeNull();
    expect(await readSessionToken(undefined, SECRET)).toBeNull();
  });
});

describe("설계 저장·권한", () => {
  it("저장하면 요약 값과 오류 수가 기록되고, 다시 저장하면 갱신", async () => {
    const { repo, t } = await setup();
    const { record } = await saveDesign(repo, t, sampleSubject());
    expect(record).toMatchObject({ name: "지구마을 첫걸음", type: "subject", grade: 3, errorCount: 0, schoolName: "광양중동초등학교" });
    const doc = sampleSubject();
    doc.intro.overallGoal = "";
    const again = await saveDesign(repo, t, doc, record.id);
    expect(again.record.errorCount).toBe(1);
    expect((await repo.designs.listByOwner(t.id)).length).toBe(1);
  });
  it("내 설계 목록에 운영 시수가 있고, 예전 저장본은 문서에서 채움", async () => {
    const { repo, t } = await setup();
    const { record } = await saveDesign(repo, t, sampleSubject());
    expect(record.hours).toBe(29);
    await repo.designs.update(record.id, { hours: undefined });
    expect((await listMyDesigns(repo, t))[0].hours).toBe(29);
  });
  it("운영 시수 경고는 목록을 볼 때 같은 학기 설계 기준으로 다시 센다 (17차시 먼저, 12차시 나중)", async () => {
    const { repo, t } = await setup();
    const mk = (name: string, hours: number) => {
      const d = sampleSubject();
      d.basic = { ...d.basic, name, hours };
      return d;
    };
    const first = await saveDesign(repo, t, mk("가 활동", 17));
    expect(first.record.hoursWarnings).toBe(1);
    const second = await saveDesign(repo, t, mk("나 활동", 12));
    expect(second.record.hoursWarnings).toBe(0);
    const list = await listMyDesigns(repo, t);
    expect(list.map((d) => d.hoursWarnings)).toEqual([0, 0]);
    expect(list.find((d) => d.id === first.record.id)!.warningCount).toBe(first.record.warningCount - 1);
  });
  it("다른 교사는 열기·고치기·삭제 불가, 관리자는 열기만 가능", async () => {
    const { repo, admin, t } = await setup();
    const other = await signup(repo, school("순천남산초등학교"), []);
    const { record } = await saveDesign(repo, t, sampleSubject());
    await expect(getDesign(repo, other, record.id)).rejects.toThrow("볼 수 없는");
    await expect(saveDesign(repo, other, sampleSubject(), record.id)).rejects.toThrow("내 설계만");
    await expect(deleteDesign(repo, other, record.id)).rejects.toThrow("내 설계만");
    expect((await getDesign(repo, admin, record.id)).name).toBe("지구마을 첫걸음");
    await expect(deleteDesign(repo, admin, record.id)).rejects.toThrow("내 설계만");
  });
  it("같은 학교·같은 학년도에 같은 이름(과목·활동, 띄어쓰기 무시)이면 알려 줌", async () => {
    const { repo, t } = await setup();
    const act = sampleSubject();
    act.basic.type = "activity";
    const first = await saveDesign(repo, t, act);
    expect(first.duplicate).toBeNull();
    const second = await saveDesign(repo, t, act);
    expect(second.duplicate?.id).toBe(first.record.id);
    const other = { ...act, application: { ...act.application, startYear: "2028" } };
    expect((await saveDesign(repo, t, other)).duplicate).toBeNull();
    // 과목도 교내 활동명과 겹치면 안 됨
    const subj = sampleSubject();
    subj.basic.name = act.basic.name.replace(/ /g, "");
    expect((await saveDesign(repo, t, subj)).duplicate).not.toBeNull();
  });
  it("형식이 틀린 문서는 거부", async () => {
    const { repo, t } = await setup();
    await expect(saveDesign(repo, t, { hello: 1 })).rejects.toThrow("형식");
  });
});

describe("관리자 통계", () => {
  it("가입 학교·설계 완성·설계 중을 센다", async () => {
    const { repo, t } = await setup();
    await saveDesign(repo, t, sampleSubject());
    const s = await adminStats(repo);
    expect(s.users).toMatchObject({ total: 2, pending: 1, resetRequests: 0, byRegion: { 광양시: 2 } });
    expect(s.designs).toMatchObject({ total: 1, complete: 1, inProgress: 0, byType: { 과목: 1 } });
  });
});

describe("시수 점검 저장", () => {
  it("학년 화면별로 저장하고 다시 불러온다", async () => {
    const { saveHourCheck, listHourChecks } = await import("./services");
    const { initialCheck } = await import("@/domain/hoursView");
    const repo = memoryRepo();
    const t = await repo.users.create({ region: "광양시", schoolName: "가초등학교", schoolKey: "가초등학교", passwordHash: "x", role: "teacher", status: "active", mustChangePassword: false, resetRequest: null, createdAt: new Date(), lastLoginAt: null });
    await saveHourCheck(repo, t, 3, initialCheck(3, 2026, []));
    await saveHourCheck(repo, t, 3, { ...initialCheck(3, 2026, []), input: { ...initialCheck(3, 2026, []).input, creativeBaseHours: 200 } });
    await saveHourCheck(repo, t, 3, initialCheck(3, 2027, []));
    const list = await listHourChecks(repo, t);
    expect(list).toHaveLength(2); // 학년도마다 따로
    expect(list.map((c) => (c.data as { schoolYear: number }).schoolYear).sort()).toEqual([2026, 2027]);
    await expect(saveHourCheck(repo, t, 4, initialCheck(3, 2026, []))).rejects.toThrow("형식");
  });
});

describe("예시안 파일", () => {
  it("한글·docx·pdf만, 4MB 이하만 올리고, 목록에는 파일 내용 없이", async () => {
    const { repo, admin } = await setup();
    const meta = { schoolYear: "2027", type: "activity", grade: "3", semester: "2", name: "지구마을 속으로" };
    const e = await uploadExample(repo, admin, meta, { name: "예시.hwpx", type: "", data: Buffer.from("abc") });
    expect(e).toMatchObject({ grade: 3, semester: 2, size: 3, fileName: "예시.hwpx" });
    await expect(uploadExample(repo, admin, meta, { name: "x.exe", type: "", data: Buffer.from("a") })).rejects.toThrow("hwp");
    await expect(uploadExample(repo, admin, meta, { name: "x.pdf", type: "", data: Buffer.alloc(5 * 1024 * 1024) })).rejects.toThrow("4MB");
    await expect(uploadExample(repo, admin, { ...meta, schoolYear: "27" }, { name: "x.pdf", type: "", data: Buffer.from("a") })).rejects.toThrow("학년도");
    const list = await listExamples(repo);
    expect(list).toHaveLength(1);
    expect("data" in list[0]).toBe(false);
    expect((await repo.examples.getFile(e.id))?.data.toString()).toBe("abc");
    await deleteExample(repo, admin, e.id);
    expect(await listExamples(repo)).toEqual([]);
  });
});

describe("관리자: 계정·설계 삭제, 전체 설계 목록", () => {
  it("계정을 지우면 그 학교 설계·시수 점검도 함께 지워지고, 자기 자신은 못 지운다", async () => {
    const { repo, admin, t } = await setup();
    await saveDesign(repo, t, sampleSubject());
    await repo.hourChecks.upsert({ ownerId: t.id, grade: 3, schoolYear: 2027, data: {}, updatedAt: new Date() });
    await expect(deleteUserByAdmin(repo, admin, admin.id)).rejects.toThrow("자기 자신");
    expect(await deleteUserByAdmin(repo, admin, t.id)).toEqual({ designs: 1 });
    expect(await repo.users.findById(t.id)).toBeNull();
    expect(await repo.designs.listByOwner(t.id)).toEqual([]);
    expect(await repo.hourChecks.listByOwner(t.id)).toEqual([]);
  });
  it("전체 설계에 학교명과 시수 점검 완료 여부가 붙고, 관리자는 아무 설계나 지울 수 있다", async () => {
    const { repo, admin, t } = await setup();
    const { record } = await saveDesign(repo, t, sampleSubject());
    const list = await listAllDesignsForAdmin(repo);
    expect(list[0]).toMatchObject({ owner: "광양마동초등학교", hoursComplete: false });
    await deleteDesignByAdmin(repo, admin, record.id);
    expect(await listAllDesignsForAdmin(repo)).toEqual([]);
  });
});

describe("관리자 전체 설계의 시수점검 완료", () => {
  it("설계 현황과 같은 규칙: 설계가 들어간 화면이 이상없음이면 완료 (예전 저장본도)", async () => {
    const { initialCheck } = await import("@/domain/hoursView");
    const { autoReduce } = await import("@/validation/allocation");
    const { saveHourCheck } = await import("./services");
    const { repo, t } = await setup();
    const d = sampleSubject();
    d.basic = { ...d.basic, grade: 5, semester: 1, hours: 32, subjectGroup: "사회" };
    const { record } = await saveDesign(repo, t, d);
    await repo.designs.update(record.id, { hours: undefined, subjectGroup: undefined }); // 예전 저장본처럼
    const c = initialCheck(5, 2027, await listMyDesigns(repo, t));
    c.input.courses.push({ name: "6학년 직접 입력", subjectKey: "국어", semester: 2, hours: 32 });
    await saveHourCheck(repo, t, 5, { ...c, input: autoReduce(c.input) });
    expect((await listAllDesignsForAdmin(repo))[0].hoursComplete).toBe(true);
  });
});
