import { describe, expect, it } from "vitest";
import { autoReduce, checkAllocation } from "@/validation/allocation";
import {
  bandStatus,
  checkOk,
  coursesFromDesigns,
  designDiff,
  initialCheck,
  schoolYearOf,
  semesterLabelWithYear,
  syncWithDesigns,
  viewYears,
  type DesignBrief,
  type HourCheck,
} from "./hoursView";

const designs: DesignBrief[] = [
  { id: "d3", name: "디지털탐험대3", grade: 3, semester: 1, hours: 29, subjectGroup: "과학" },
  { id: "d4", name: "우리 마을", grade: 4, semester: 2, hours: 29, subjectGroup: "사회" },
  { id: "d5", name: "경제", grade: 5, semester: 1, hours: 32, subjectGroup: "사회" },
];

/** 설계 현황을 넣고 교과 시수를 자동 감축한 '이상없음' 화면 */
const okCheck = (grade: 3 | 4, ds = designs): HourCheck => {
  const c = initialCheck(grade, 2026, ds);
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
    const c = okCheck(3);
    c.input.courses.push({ name: "직접 추가", subjectKey: "국어", semester: 1, hours: 10 });
    const changed = designs.map((d) => (d.id === "d4" ? { ...d, hours: 19 } : d));
    expect(designDiff(c, changed)).toEqual(["「우리 마을」의 차시·학기·교과가 설계와 달라요."]);
    const synced = syncWithDesigns(c, changed);
    expect(synced.input.courses.find((x) => x.designId === "d4")?.hours).toBe(19);
    expect(synced.input.courses.some((x) => x.name === "직접 추가")).toBe(true);
  });
  it("학년군의 두 화면이 모두 이상없음이어야 완료", () => {
    expect(checkAllocation(okCheck(3).input).issues).toEqual([]);
    expect(bandStatus(3, { 3: okCheck(3) }, designs).complete).toBe(false);
    expect(bandStatus(4, { 3: okCheck(3), 4: okCheck(4) }, designs).complete).toBe(true);
    // 설계 차시를 바꾸면 다시 점검 필요
    const changed = designs.map((d) => (d.id === "d3" ? { ...d, semester: 2 } : d));
    expect(checkOk(okCheck(3), changed)).toBe(false);
  });
  it("한 학년만 앱으로 설계해도, 다른 학년을 직접 입력해 맞추면 완료", () => {
    const only3 = designs.filter((d) => d.grade === 3);
    expect(bandStatus(3, {}, only3).gradesWithoutDesign).toEqual([4]);
    const manual = (g: 3 | 4) => {
      const c = initialCheck(g, 2026, only3);
      c.input.courses.push({ name: "4학년 직접 입력", subjectKey: "사회", semester: 3, hours: 29 });
      return { ...c, input: autoReduce(c.input) };
    };
    expect(bandStatus(3, { 3: manual(3), 4: manual(4) }, only3).complete).toBe(true);
  });
});
