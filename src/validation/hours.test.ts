import { describe, expect, it } from "vitest";
import type { Plan } from "@/domain/types";
import {
  checkBasicHours,
  checkPlanHours,
  checkSemesterTotal,
  lessonLabels,
  semesterHours,
  checkUnitHours,
  checkSemesterBudget,
} from "./hours";

const lesson = (hours: number, assessment = "") => ({
  hours,
  topic: "주제",
  goal: "알아봅시다.",
  activities: ["활동"],
  assessment,
  assessFor: "",
  inputActivities: [],
  note: "",
});

describe("semesterHours", () => {
  it("3·4학년은 29시간, 5·6학년은 32시간", () => {
    expect(semesterHours(3)).toBe(29);
    expect(semesterHours(4)).toBe(29);
    expect(semesterHours(5)).toBe(32);
    expect(semesterHours(6)).toBe(32);
  });
});

describe("checkBasicHours", () => {
  it("기준 시수와 같으면 문제 없음", () => {
    expect(checkBasicHours({ grade: 3, hours: 29, type: "subject" })).toEqual([]);
  });
  it("10시간 미만이면 오류", () => {
    const issues = checkBasicHours({ grade: 5, hours: 9, type: "activity" });
    expect(issues.some((i) => i.level === "error" && i.message.includes("최소 10차시"))).toBe(true);
  });
  it("학기 시수를 넘으면 오류", () => {
    const issues = checkBasicHours({ grade: 3, hours: 30, type: "subject" });
    expect(issues.some((i) => i.level === "error")).toBe(true);
  });
  it("학기 시수보다 적으면 경고 (나머지를 다른 과목/활동으로 채워야 함)", () => {
    const issues = checkBasicHours({ grade: 6, hours: 20, type: "activity" });
    expect(issues).toHaveLength(1);
    expect(issues[0].level).toBe("warning");
    expect(issues[0].message).toContain("12시간");
  });
});

describe("checkPlanHours", () => {
  const plan: Plan = {
    title: "안",
    concept: "특징",
    units: [
      { unitName: "1단원", standardIds: [], lessons: [lesson(1), lesson(2, "[과정중심평가] 발표")] },
      { unitName: "2단원", standardIds: [], lessons: [lesson(3)] },
    ],
  };
  it("차시 합계가 운영 시수와 같으면 문제 없음", () => {
    expect(checkPlanHours(plan, { hours: 6 })).toEqual([]);
  });
  it("차시 합계가 모자라면 오류와 고칠 방법을 알려 줌", () => {
    const issues = checkPlanHours(plan, { hours: 8 });
    expect(issues[0].level).toBe("error");
    expect(issues[0].fix).toContain("2시간 늘려");
  });
});

describe("lessonLabels", () => {
  it("차시 번호를 이어서 붙임", () => {
    const units = [
      { unitName: "a", lessons: [lesson(1), lesson(2)] },
      { unitName: "b", lessons: [lesson(1)] },
    ];
    expect(lessonLabels(units, 29)).toEqual([["1/29", "2~3/29"], ["4/29"]]);
  });
});

describe("checkSemesterTotal (지침 6쪽 예시)", () => {
  it("3학년 1학기 활동 2개(12+17) 가능", () => {
    expect(checkSemesterTotal(3, [{ name: "가", hours: 12 }, { name: "나", hours: 17 }])).toEqual([]);
  });
  it("5학년 1학기 활동 3개(10+10+12) 가능", () => {
    expect(
      checkSemesterTotal(5, [
        { name: "가", hours: 10 },
        { name: "나", hours: 10 },
        { name: "다", hours: 12 },
      ]),
    ).toEqual([]);
  });
  it("6학년 1학기 활동 2개(10+12) 불가 — 32시간이 안 됨", () => {
    const issues = checkSemesterTotal(6, [{ name: "가", hours: 10 }, { name: "나", hours: 12 }]);
    expect(issues.some((i) => i.field === "학기 시수 합계")).toBe(true);
  });
  it("4개 개설은 불가", () => {
    const issues = checkSemesterTotal(5, [
      { name: "가", hours: 8 },
      { name: "나", hours: 8 },
      { name: "다", hours: 8 },
      { name: "라", hours: 8 },
    ]);
    expect(issues.some((i) => i.field === "학기 개설 수")).toBe(true);
  });
});

describe("단원별 차시", () => {
  it("문제 없으면 빈 목록 (단원별 최소 차시 규칙은 없음)", () => {
    expect(checkUnitHours(32, [{ name: "가", hours: 25 }, { name: "나", hours: 4 }, { name: "다", hours: 3 }])).toEqual([]);
  });
  it("0차시 단원과 합계 오류", () => {
    const issues = checkUnitHours(32, [{ name: "가", hours: 0 }, { name: "나", hours: 29 }]);
    expect(issues.some((i) => i.field === "1단원(가)")).toBe(true);
    expect(issues.some((i) => i.field === "단원별 차시 합계" && i.message.includes("3차시 적습니다"))).toBe(true);
  });
});

describe("같은 학기 다른 설계를 생각한 시수 (checkSemesterBudget)", () => {
  const b = (grade: 3 | 5, hours: number) => ({ grade, semester: 1 as const, hours });
  it("3학년 10차시 과목 + 19차시 활동 = 29 → 문제 없음", () => {
    expect(checkSemesterBudget(b(3, 19), [{ name: "과목", hours: 10 }])).toEqual([]);
  });
  it("이미 32차시를 편성한 학기에는 더 못 만듦", () => {
    const issues = checkSemesterBudget(b(5, 10), [{ name: "활동", hours: 32 }]);
    expect(issues[0].message).toContain("더 만들 수 없습니다");
  });
  it("10+10 다음에 10을 만들면 2차시가 남아 오류, 12면 통과", () => {
    const others = [{ name: "가", hours: 10 }, { name: "나", hours: 10 }];
    expect(checkSemesterBudget(b(5, 10), others)[0].message).toContain("2차시가 남는데");
    expect(checkSemesterBudget(b(5, 12), others)).toEqual([]);
  });
  it("남은 차시보다 많으면 오류", () => {
    expect(checkSemesterBudget(b(5, 20), [{ name: "가", hours: 20 }])[0].message).toContain("12차시만 남았습니다");
  });
  it("처음 만드는 설계도 남는 차시가 1~9면 오류 (예: 3학년 25차시 → 4차시 남음)", () => {
    expect(checkSemesterBudget(b(3, 25), [])[0].message).toContain("4차시가 남는데");
    expect(checkSemesterBudget(b(3, 19), [])).toEqual([]);
  });
  it("학기당 최대 3개", () => {
    const others = [{ name: "가", hours: 10 }, { name: "나", hours: 10 }, { name: "다", hours: 10 }];
    expect(checkSemesterBudget(b(5, 2), others)[0].message).toContain("최대 3개");
  });
});
