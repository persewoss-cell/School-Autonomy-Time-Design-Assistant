import { describe, expect, it } from "vitest";
import type { Plan } from "@/domain/types";
import {
  checkBasicHours,
  checkPlanHours,
  checkSemesterTotal,
  lessonLabels,
  semesterHours,
} from "./hours";

const lesson = (hours: number, assessment = "") => ({
  hours,
  topic: "주제",
  goal: "알아봅시다.",
  activities: ["활동"],
  assessment,
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
  it("과정중심평가가 없으면 경고", () => {
    const noAssess: Plan = { ...plan, units: [{ unitName: "1", standardIds: [], lessons: [lesson(6)] }] };
    expect(checkPlanHours(noAssess, { hours: 6 }).some((i) => i.field === "과정중심평가")).toBe(true);
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
