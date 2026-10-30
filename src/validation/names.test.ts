import { describe, expect, it } from "vitest";
import { findSameName, nameKey, sameNameMessage } from "./names";

describe("교내 이름 중복 (과목·활동)", () => {
  const others = [{ name: "자전거 하이킹", type: "activity" as const, grade: 3, semester: 1 }];
  it("띄어쓰기는 무시하고 비교한다", () => {
    expect(nameKey(" 자전거  하이킹 ")).toBe("자전거하이킹");
    expect(findSameName("자전거하이킹", others)).toBe(others[0]);
  });
  it("과목도 교내 활동명과 겹치면 안 된다 (학년이 달라도)", () => {
    expect(sameNameMessage(findSameName("자전거 하이킹", others)!)).toBe("같은 학년도에 이미 「자전거 하이킹」 활동이 있어요. (3학년 1학기)");
  });
  it("다른 이름이면 통과", () => {
    expect(findSameName("자전거 하이킹4", others)).toBeNull();
    expect(findSameName("  ", others)).toBeNull();
  });
});
