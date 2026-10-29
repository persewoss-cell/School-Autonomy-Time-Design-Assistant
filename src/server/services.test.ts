import { describe, expect, it } from "vitest";
import { sampleSubject } from "@/domain/sample";
import { memoryRepo } from "./repo";
import { adminStats, deleteDesign, getDesign, login, saveDesign, signup, updateUserByAdmin } from "./services";
import { createSessionToken, readSessionToken } from "./session";

const SECRET = "test-secret-test-secret-test-secret-123";
const teacher = { email: "Kim@School.kr", password: "password1", name: "김교사", schoolName: "광양중동초등학교" };

async function setup() {
  const repo = memoryRepo();
  const admin = await signup(repo, { ...teacher, email: "admin@school.kr", name: "관리자" }, ["admin@school.kr"]);
  const t = await signup(repo, teacher, ["admin@school.kr"]);
  return { repo, admin, t };
}

describe("회원가입·로그인", () => {
  it("관리자 이메일은 바로 관리자, 나머지는 승인 대기", async () => {
    const { admin, t } = await setup();
    expect([admin.role, admin.status]).toEqual(["admin", "active"]);
    expect([t.role, t.status, t.email]).toEqual(["teacher", "pending", "kim@school.kr"]);
  });
  it("승인 전에는 로그인 불가, 승인 후 가능", async () => {
    const { repo, admin, t } = await setup();
    await expect(login(repo, "kim@school.kr", "password1")).rejects.toThrow("승인");
    await updateUserByAdmin(repo, admin, t.id, { status: "active" });
    expect((await login(repo, "KIM@school.kr", "password1")).id).toBe(t.id);
  });
  it("비밀번호가 틀리면 실패 (원문 저장 안 함)", async () => {
    const { repo } = await setup();
    await expect(login(repo, "admin@school.kr", "wrong-pass")).rejects.toThrow("맞지 않습니다");
    const u = await repo.users.findByEmail("admin@school.kr");
    expect(u!.passwordHash).not.toContain("password1");
  });
  it("중복 가입, 짧은 비밀번호 거부", async () => {
    const { repo } = await setup();
    await expect(signup(repo, teacher, [])).rejects.toThrow("이미 가입");
    await expect(signup(repo, { ...teacher, email: "x@y.kr", password: "short" }, [])).rejects.toThrow("8자");
  });
  it("관리자는 자기 자신을 못 바꾸고, 교사는 관리 기능 불가", async () => {
    const { repo, admin, t } = await setup();
    await expect(updateUserByAdmin(repo, admin, admin.id, { role: "teacher" })).rejects.toThrow("자기 자신");
    await expect(updateUserByAdmin(repo, t, admin.id, { status: "blocked" })).rejects.toThrow("관리자만");
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
  it("다른 교사는 열기·고치기·삭제 불가, 관리자는 열기만 가능", async () => {
    const { repo, admin, t } = await setup();
    const other = await signup(repo, { ...teacher, email: "lee@school.kr" }, []);
    const { record } = await saveDesign(repo, t, sampleSubject());
    await expect(getDesign(repo, other, record.id)).rejects.toThrow("볼 수 없는");
    await expect(saveDesign(repo, other, sampleSubject(), record.id)).rejects.toThrow("내 설계만");
    await expect(deleteDesign(repo, other, record.id)).rejects.toThrow("내 설계만");
    expect((await getDesign(repo, admin, record.id)).name).toBe("지구마을 첫걸음");
    await expect(deleteDesign(repo, admin, record.id)).rejects.toThrow("내 설계만");
  });
  it("같은 학교·같은 학년도에 같은 활동명이면 알려 줌 (과목은 해당 없음)", async () => {
    const { repo, t } = await setup();
    const act = sampleSubject();
    act.basic.type = "activity";
    const first = await saveDesign(repo, t, act);
    expect(first.duplicate).toBeNull();
    const second = await saveDesign(repo, t, act);
    expect(second.duplicate?.id).toBe(first.record.id);
    const other = { ...act, application: { ...act.application, startYear: "2028" } };
    expect((await saveDesign(repo, t, other)).duplicate).toBeNull();
  });
  it("형식이 틀린 문서는 거부", async () => {
    const { repo, t } = await setup();
    await expect(saveDesign(repo, t, { hello: 1 })).rejects.toThrow("형식");
  });
});

describe("관리자 통계", () => {
  it("사용자·설계·기록을 센다", async () => {
    const { repo, t } = await setup();
    await saveDesign(repo, t, sampleSubject());
    await repo.logs.add({ kind: "parse_fail", detail: "standards: JSON 형식이 깨져 있습니다." });
    const s = await adminStats(repo);
    expect(s.users).toMatchObject({ total: 2, pending: 1 });
    expect(s.designs).toMatchObject({ total: 1, complete: 1, byType: { 과목: 1 } });
    expect(s.week.parseFailByStep).toEqual({ standards: 1 });
  });
});
