import { describe, expect, it } from "vitest";
import { makeDemoPlans } from "./demoPlans";
import { totalLessonHours } from "@/validation/hours";
import { sampleSubject } from "@/domain/sample";

describe("makeDemoPlans", () => {
  it("3안을 만들고 각 안의 차시 합계가 운영 시수와 같다", () => {
    const doc = sampleSubject();
    for (const hours of [10, 17, 29, 32]) {
      const plans = makeDemoPlans({ ...doc, basic: { ...doc.basic, hours } });
      expect(plans).toHaveLength(3);
      for (const p of plans) expect(totalLessonHours(p.units)).toBe(hours);
    }
  });
  it("영역을 단원으로, 그 영역의 성취기준을 단원에 배치", () => {
    const p = makeDemoPlans(sampleSubject())[0];
    expect(p.units.map((u) => u.unitName)).toEqual(["세계시민의 이해", "문화 다양성과 존중"]);
    expect(p.units[1].standardIds).toEqual(["s3", "s4"]);
  });
});
