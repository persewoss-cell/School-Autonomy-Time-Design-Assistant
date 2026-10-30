import { describe, expect, it } from "vitest";
import {
  checkAllocation,
  defaultAllocation,
  oneWeekHours,
  rangeMax,
  rangeMin,
  semesterAutonomyHours,
  type AllocationInput,
} from "./allocation";

describe("엑셀 계산식", () => {
  it("1주 수업시간 = 기준시수 ÷ 34 ÷ 2", () => {
    expect(oneWeekHours(408)).toBe(6);
    expect(oneWeekHours(204)).toBe(3);
  });
  it("증감범위 = ROUNDUP(×0.8) ~ ROUNDDOWN(×1.2)", () => {
    expect([rangeMin(408), rangeMax(408)]).toEqual([327, 489]);
    expect([rangeMin(68), rangeMax(68)]).toEqual([55, 81]);
    expect([rangeMin(136), rangeMax(136)]).toEqual([109, 163]);
  });
  it("체육·음악·미술은 하한이 기준시수 (감축 불가)", () => {
    expect(rangeMin(204, true)).toBe(204);
  });
  it("학기별 학교자율시간: 3~4학년 29, 5~6학년 32", () => {
    expect(semesterAutonomyHours("3-4")).toBe(29);
    expect(semesterAutonomyHours("5-6")).toBe(32);
  });
});

/** 학교자율시간 시수만큼 해당 학기 교과·창체를 1주 분량씩 줄인 정상 편성 */
function validPlan(): AllocationInput {
  const a = defaultAllocation("3-4");
  a.courses = [
    { name: "지구마을 첫걸음", subjectKey: "사회", semester: 1, hours: 29 },
    { name: "우리 고장 탐험", subjectKey: "국어", semester: 2, hours: 29 },
  ];
  // 3학년 2학기(1), 4학년 1학기(2): 각 교과·창체 1주 분량 감축 (국어6 사회3 도덕1 수학4 과학3 체육3 음악2 미술2 영어2 창체3 = 29)
  const cut: Record<string, number> = { 국어: 6, 사회: 3, 도덕: 1, 수학: 4, 과학: 3, 체육: 0, 음악: 0, 미술: 0, 영어: 2 };
  for (const s of [1, 2] as const) {
    for (const [k, v] of Object.entries(cut)) a.subjectHours[k][s] -= v;
    a.creativeHours[s] -= 3;
  }
  // 체육·음악·미술은 줄일 수 없으므로 나머지 7시간(3+2+2)은 국어·수학에서 추가 감축
  for (const s of [1, 2] as const) {
    a.subjectHours["국어"][s] -= 4;
    a.subjectHours["수학"][s] -= 3;
  }
  return a;
}

describe("checkAllocation", () => {
  it("정상 편성은 문제 없음", () => {
    const r = checkAllocation(validPlan());
    expect(r.issues).toEqual([]);
    expect(r.total.ok).toBe(true);
    expect(r.autonomyBySemester).toEqual([0, 29, 29, 0]);
  });

  it("학교자율시간만 넣고 교과를 안 줄이면 총시수 초과", () => {
    const a = defaultAllocation("3-4");
    a.courses = [
      { name: "가", subjectKey: "사회", semester: 0, hours: 29 },
      { name: "나", subjectKey: "사회", semester: 2, hours: 29 },
    ];
    const r = checkAllocation(a);
    expect(r.issues.some((i) => i.field === "학년군 총 수업 시간 수" && i.message.includes("58시간 많습니다"))).toBe(true);
  });

  it("지침 예시: 체육 186 + 체육 편성 학교자율시간 17 = 203 → 불가", () => {
    const a = validPlan();
    a.subjectHours["체육"] = [47, 47, 46, 46]; // 186
    a.courses.push({ name: "도전 체육", subjectKey: "체육", semester: 3, hours: 17 });
    const r = checkAllocation(a);
    const pe = r.rows.find((x) => x.label === "체육")!;
    expect(pe.planned).toBe(203);
    expect(pe.ok).toBe(false);
    expect(r.issues.some((i) => i.field === "체육" && i.message.includes("줄일 수 없습니다"))).toBe(true);
  });

  it("지침 예시: 체육 204 + 체육 편성 29 = 233 → 가능 (20% 이내 증)", () => {
    const a = defaultAllocation("3-4");
    a.courses = [{ name: "외발자전거", subjectKey: "체육", semester: 0, hours: 29 }];
    const pe = checkAllocation(a).rows.find((x) => x.label === "체육")!;
    expect(pe.planned).toBe(233);
    expect(pe.ok).toBe(true);
  });

  it("증감 범위는 교과(군) 단위 (지침 26쪽): 사회/도덕 합계로 본다", () => {
    const a = validPlan();
    a.subjectHours["도덕"] = [10, 10, 10, 10]; // 도덕만 보면 40 < 55지만 사회/도덕 합계는 범위 안
    a.subjectHours["사회"] = a.subjectHours["사회"].map((h) => h + 7) as typeof a.subjectHours["사회"];
    expect(checkAllocation(a).issues.some((i) => i.field === "도덕" || i.field === "사회/도덕")).toBe(false);
    a.subjectHours["사회"] = [30, 30, 30, 30]; // 사회/도덕 160 < 218
    expect(checkAllocation(a).issues.some((i) => i.field === "사회/도덕" && i.message.includes("교과(군) 증감 범위"))).toBe(true);
  });
  it("음악·미술은 교과마다 기준시수보다 줄일 수 없음 (교과군 합계가 맞아도)", () => {
    const a = validPlan();
    a.subjectHours["음악"] = a.subjectHours["음악"].map((h, i) => (i === 0 ? h - 2 : h)) as typeof a.subjectHours["음악"];
    a.subjectHours["미술"] = a.subjectHours["미술"].map((h, i) => (i === 0 ? h + 2 : h)) as typeof a.subjectHours["미술"];
    expect(checkAllocation(a).issues.some((i) => i.field === "음악" && i.message.includes("줄일 수 없습니다"))).toBe(true);
  });

  it("학년별 한 학기 이상 운영해야 함", () => {
    const a = validPlan();
    a.courses = a.courses.filter((c) => c.semester !== 2);
    expect(checkAllocation(a).issues.some((i) => i.field === "4학년 학교자율시간")).toBe(true);
  });

  it("운영 학기의 합계는 1주 분량(29)이어야 함, 10시간 미만 불가", () => {
    const a = validPlan();
    a.courses.push({ name: "짧은 활동", subjectKey: "미술", semester: 1, hours: 5 });
    const r = checkAllocation(a);
    expect(r.issues.some((i) => i.field === "3학년 2학기 학교자율시간")).toBe(true);
    expect(r.issues.some((i) => i.field === "짧은 활동")).toBe(true);
  });

  it("5~6학년: 실과·음악/미술 교과 포함, 학기 32시간", () => {
    const a = defaultAllocation("5-6");
    expect(Object.keys(a.subjectHours)).toContain("실과");
    a.courses = [{ name: "나도 인문작가", subjectKey: "국어", semester: 0, hours: 32 }];
    const r = checkAllocation(a);
    expect(r.semesterTarget).toBe(32);
    expect(r.total.baseHours).toBe(2176);
  });
});
