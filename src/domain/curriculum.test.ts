import { describe, expect, it } from "vitest";
import data from "../../data/curriculum/standards-2022.json";

describe("2022 개정 교육과정 성취기준 자료 (사용자가 올린 엑셀)", () => {
  it("3~6학년 511개, 코드 형식이 맞고 겹치지 않는다", () => {
    expect(data).toHaveLength(511);
    for (const r of data) {
      expect(["3~4학년군", "5~6학년군"]).toContain(r.band);
      expect(r.code).toMatch(/^\[[46][가-힣]+\d{2}-\d{2}\]$/);
      expect(r.text.length).toBeGreaterThan(5);
      expect(r.area).not.toBe("");
    }
    expect(new Set(data.map((r) => r.code)).size).toBe(data.length);
  });
});
