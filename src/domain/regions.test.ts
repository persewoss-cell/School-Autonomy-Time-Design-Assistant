import { describe, expect, it } from "vitest";
import { REGION_VALUES } from "./regions";

describe("지역 목록", () => {
  it("시·군·구 이름만, 27개, 가나다 오름차순", () => {
    expect(REGION_VALUES).toHaveLength(27);
    expect(REGION_VALUES.slice(0, 4)).toEqual(["강진군", "고흥군", "곡성군", "광산구"]);
    expect(REGION_VALUES.at(-1)).toBe("화순군");
    expect(REGION_VALUES.some((r) => /전남|광주/.test(r))).toBe(false);
  });
});
