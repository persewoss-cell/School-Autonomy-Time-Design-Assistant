import { describe, expect, it } from "vitest";
import { sampleSubject } from "./sample";
import { recommendedUnitHours, unitHoursFor } from "./unitHours";

describe("단원별 차시 추천", () => {
  it("내용 요소 수 비율로 (합계 = 운영 시수)", () => {
    const doc = sampleSubject(); // 영역 2개: 내용 요소 5개, 4개 / 29차시
    expect(recommendedUnitHours(doc)).toEqual([16, 13]);
    doc.basic.hours = 32;
    doc.areas.push({ name: "다", knowledge: ["가"], process: ["나하기"], values: ["다"] });
    const r = recommendedUnitHours(doc);
    expect(r.reduce((a, b) => a + b, 0)).toBe(32);
    expect(r.every((h) => h >= 1)).toBe(true);
  });
  it("교사가 적은 칸은 그대로, 빈칸은 남은 차시로 채움", () => {
    const doc = sampleSubject();
    doc.planRequest = { unitHours: [19, null], mustInclude: [], notes: "" };
    expect(unitHoursFor(doc)).toEqual([19, 10]);
  });
});
