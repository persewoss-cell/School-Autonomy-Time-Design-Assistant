import { describe, expect, it } from "vitest";
import { checkActivityName, nameKey } from "./names";

describe("활동명 중복", () => {
  const others = [{ name: "자전거 하이킹", grade: 3, semester: 1 }];
  it("띄어쓰기는 무시하고 비교한다", () => {
    expect(nameKey(" 자전거  하이킹 ")).toBe("자전거하이킹");
    expect(checkActivityName("자전거하이킹", others)).toHaveLength(1);
    expect(checkActivityName("자전거 하이킹", others)[0].level).toBe("error");
  });
  it("다른 이름이면 통과", () => {
    expect(checkActivityName("자전거 하이킹4", others)).toEqual([]);
    expect(checkActivityName("", others)).toEqual([]);
  });
});
