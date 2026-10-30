import type { Area, DesignDoc } from "./types";

/** 영역의 내용 요소 수 (빈칸 제외) */
export const elementCount = (a: Area) => [...a.knowledge, ...a.process, ...a.values].filter((s) => s.trim()).length;

/**
 * 영역별 성취기준 추천 개수: 성취기준 하나가 내용 요소 2~3개를 묶으므로 '내용 요소 수 ÷ 2.5'를 반올림,
 * 지침(영역별 2가지 이상)에 맞춰 최소 2개, 너무 많지 않게 최대 6개.
 */
export function recommendedStandardCount(a: Area): number {
  return Math.min(6, Math.max(2, Math.round(elementCount(a) / 2.5)));
}

/** 교사가 정한 영역별 성취기준 수 (정하지 않은 영역은 추천 개수) */
export function standardCountsFor(doc: Pick<DesignDoc, "areas" | "standardCounts">): number[] {
  return doc.areas.map((a, i) => {
    const n = doc.standardCounts?.[i];
    return typeof n === "number" && n >= 1 ? n : recommendedStandardCount(a);
  });
}
