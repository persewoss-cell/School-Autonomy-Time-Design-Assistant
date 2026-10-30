import { describe, expect, it } from "vitest";
import { sampleSubject } from "./sample";
import { manualAreas, manualAssessments, manualCoreIdeas, manualPlan, manualStandards } from "./manual";
import { totalLessonHours } from "@/validation/hours";

describe("AI 없이 직접 입력하기: 빈칸 틀", () => {
  it("내용 체계: 정해 둔 영역명·영역 수대로, 없으면 2개", () => {
    const doc = sampleSubject();
    expect(manualAreas({ input: { ...doc.input, areaCount: null, areaNames: [] } })).toHaveLength(2);
    const a = manualAreas({ input: { ...doc.input, areaCount: 3, areaNames: ["가", "나"] } });
    expect(a.map((x) => x.name)).toEqual(["가", "나", ""]);
    expect(a[0]).toMatchObject({ knowledge: [""], process: [""], values: [""] });
  });
  it("핵심아이디어·성취기준·평가 계획은 앞 단계 수에 맞춘다", () => {
    const doc = sampleSubject();
    expect(manualCoreIdeas(doc)).toHaveLength(doc.areas.length);
    const st = manualStandards({ areas: doc.areas, standardCounts: [3] });
    expect(st.filter((s) => s.areaIndex === 0)).toHaveLength(3);
    expect(st.filter((s) => s.areaIndex === 1)).toHaveLength(2);
    expect(manualAssessments(doc)).toHaveLength(doc.standards.length);
  });
  it("단원 지도계획: 영역마다 단원, 차시 합계는 운영 시수", () => {
    const doc = sampleSubject();
    const p = manualPlan(doc);
    expect(p.units.map((u) => u.unitName)).toEqual(doc.areas.map((a) => a.name));
    expect(totalLessonHours(p.units)).toBe(doc.basic.hours);
  });
});
