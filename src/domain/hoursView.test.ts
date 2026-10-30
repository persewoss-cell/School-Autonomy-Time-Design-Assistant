import { describe, expect, it } from "vitest";
import { autoReduce, checkAllocation } from "@/validation/allocation";
import {
  bandStatus,
  carryWarnings,
  checkKey,
  checkOk,
  coursesFromDesigns,
  designDiff,
  importDesigns,
  initialCheck,
  missingHalves,
  restoreHalf,
  schoolYearOf,
  semesterLabelWithYear,
  syncWithDesigns,
  viewYears,
  type DesignBrief,
  type HourCheck,
} from "./hoursView";

const designs: DesignBrief[] = [
  { id: "d3", name: "디지털탐험대3", grade: 3, semester: 1, hours: 29, subjectGroup: "과학", schoolYear: "2027" },
  { id: "d4", name: "우리 마을", grade: 4, semester: 2, hours: 29, subjectGroup: "사회", schoolYear: "2027" },
  { id: "d5", name: "경제", grade: 5, semester: 1, hours: 32, subjectGroup: "사회", schoolYear: "2027" },
];

/**
 * 설계 현황을 넣고, 설계가 없는 학년(다른 학년도)은 직접 입력한 뒤 교과 시수를 자동 감축한 '이상없음' 화면.
 * 예: 2027학년도 3학년 화면 = 3학년(2027, 설계 d3) + 4학년(2028, 직접 입력)
 */
const okCheck = (grade: 3 | 4, ds = designs, year = 2027): HourCheck => {
  const c = initialCheck(grade, year, ds);
  for (const half of [0, 1] as const) {
    if (!c.input.courses.some((x) => Math.floor(x.semester / 2) === half))
      c.input.courses.push({ name: `직접 입력 ${half}`, subjectKey: "사회", semester: (half * 2) as 0 | 2, hours: 29 });
  }
  return { ...c, input: autoReduce(c.input) };
};

describe("학년별 시수 점검 화면", () => {
  it("학년도: 3월부터 새 학년도", () => {
    expect(schoolYearOf(new Date(2026, 9, 30))).toBe(2026);
    expect(schoolYearOf(new Date(2027, 1, 10))).toBe(2026);
  });
  it("3학년 화면 = 3학년(올해)+4학년(내년), 4학년 화면 = 3학년(작년)+4학년(올해)", () => {
    expect(viewYears(3, 2026)).toEqual([2026, 2026, 2027, 2027]);
    expect(viewYears(4, 2026)).toEqual([2025, 2025, 2026, 2026]);
    expect(semesterLabelWithYear(6, 2026, 3)).toBe("6학년 2학기 (2026)");
  });
  it("설계 현황의 학교자율시간을 그 학년군 학기에 넣는다", () => {
    expect(coursesFromDesigns("3-4", designs)).toEqual([
      { name: "디지털탐험대3", subjectKey: "과학", semester: 0, hours: 29, designId: "d3" },
      { name: "우리 마을", subjectKey: "사회", semester: 3, hours: 29, designId: "d4" },
    ]);
  });
  it("설계가 바뀌면 다른 점을 알리고, 반영하면 직접 추가한 것은 남긴다", () => {
    const c = okCheck(4);
    c.input.courses.push({ name: "직접 추가", subjectKey: "국어", semester: 1, hours: 10 });
    const changed = designs.map((d) => (d.id === "d4" ? { ...d, hours: 19 } : d));
    expect(designDiff(c, changed)).toEqual(["「우리 마을」의 차시·학기·교과가 설계와 달라요."]);
    const synced = syncWithDesigns(c, changed);
    expect(synced.input.courses.find((x) => x.designId === "d4")?.hours).toBe(19);
    expect(synced.input.courses.some((x) => x.name === "직접 추가")).toBe(true);
  });
  it("학년군의 두 화면이 모두 이상없음이어야 완료", () => {
    expect(checkAllocation(okCheck(3).input).issues).toEqual([]);
    const checks = { [checkKey(2027, 3)]: okCheck(3) };
    expect(bandStatus(3, 2027, checks, designs).complete).toBe(false);
    checks[checkKey(2027, 4)] = okCheck(4);
    expect(bandStatus(4, 2027, checks, designs).complete).toBe(true);
    // 다른 학년도는 따로 점검
    expect(bandStatus(3, 2028, checks, designs).complete).toBe(false);
    // 설계 차시를 바꾸면 다시 점검 필요
    const changed = designs.map((d) => (d.id === "d3" ? { ...d, semester: 2 } : d));
    expect(checkOk(okCheck(3), changed)).toBe(false);
  });
  it("한 학년만 앱으로 설계해도, 다른 학년을 직접 입력해 맞추면 완료", () => {
    const only3 = designs.filter((d) => d.grade === 3);
    expect(bandStatus(3, 2027, {}, only3).gradesWithoutDesign).toEqual([4]);
    const checks = { [checkKey(2027, 3)]: okCheck(3, only3), [checkKey(2027, 4)]: okCheck(4, only3) };
    expect(bandStatus(3, 2027, checks, only3).complete).toBe(true);
  });
});

describe("학년도별 시수 점검", () => {
  it("설계는 그 학년도 화면에만 들어간다 (2027 3학년 설계 → 2028학년도 4학년 화면의 3학년 부분)", () => {
    expect(initialCheck(3, 2028, designs).input.courses).toEqual([]);
    const v = initialCheck(4, 2028, designs);
    expect(v.input.courses.map((c) => [c.name, c.semester])).toEqual([["디지털탐험대3", 0]]);
  });
  it("이전 학년도에 점검한 시수를 그대로 이어받고, 고치면 경고", () => {
    const c3 = okCheck(3);
    c3.input.subjectHours["국어"] = [100, 100, 104, 104];
    const checks = { [checkKey(2027, 3)]: { ...c3, updatedAt: "2027-04-01" } };
    const v = initialCheck(4, 2028, designs, checks);
    expect(v.input.subjectHours["국어"].slice(0, 2)).toEqual([100, 100]);
    expect(carryWarnings(v, checks)).toEqual([]);
    v.input.subjectHours["국어"][0] = 99;
    const w = carryWarnings(v, checks);
    expect(w).toHaveLength(1);
    expect(w[0].message).toContain("3학년(2027학년도)");
    expect(restoreHalf(v, 0, w[0].source, w[0].sourceHalf).input.subjectHours["국어"][0]).toBe(100);
  });
  it("그 학년도 설계가 없으면 알리고, 원하면 가장 최근 학년도 설계를 가져온다", () => {
    const v = initialCheck(3, 2028, designs);
    const miss = missingHalves(v, designs);
    expect(miss).toEqual([
      { half: 0, grade: 3, year: 2028, fromYear: 2027 },
      { half: 1, grade: 4, year: 2029, fromYear: 2027 },
    ]);
    const imported = importDesigns(v, 0, 2027, designs);
    expect(imported.input.courses).toEqual([{ name: "디지털탐험대3 (2027 설계)", subjectKey: "과학", semester: 0, hours: 29 }]);
  });
});

describe("편성표 양식 줄 구성", () => {
  it("교과(군)별로 묶고, 학교자율시간은 교과 아래 줄, 3~4학년 과학/실과에는 빈 실과 줄", async () => {
    const { formModel } = await import("./allocationForm");
    const c = initialCheck(3, 2027, designs);
    const m = formModel(c.input);
    const sci = m.groups.find((g) => g.label === "과학/실과")!;
    expect(sci.lines.map((l) => (l.kind === "subject" ? l.key : l.kind === "course" ? l.name : `(${l.name})`))).toEqual(["과학", "디지털탐험대3", "(실과)"]);
    expect(m.groups.find((g) => g.label === "수학")!.merged).toBe(true);
    expect(m.groups.find((g) => g.label === "예술")).toMatchObject({ base: 272, min: 272, max: 326, noReduction: true });
    expect(m.creative.parts.map((p) => p.name)).toEqual(["자율·자치활동", "동아리활동", "진로활동"]);
  });
});
