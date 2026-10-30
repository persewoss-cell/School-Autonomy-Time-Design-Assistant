import type { Area, DesignDoc } from "./types";

/** 영역의 내용 요소 수 (빈칸 제외) */
export const elementCount = (a: Area) => [...a.knowledge, ...a.process, ...a.values].filter((s) => s.trim()).length;

/**
 * 영역별 성취기준 수의 범위.
 * 내용 요소 하나는 성취기준 하나에만 들어가고, 성취기준 하나는 내용 요소 2~3개를 묶으므로
 * 내용 요소 n개를 겹치지 않게 모두 나누면 최소 ⌈n÷3⌉개, 최대 ⌊n÷2⌋개.
 * (내용 요소가 3개 이하면 1개)
 */
export function standardCountRange(a: Area): { min: number; max: number } {
  const n = elementCount(a);
  if (n <= 3) return { min: 1, max: 1 };
  return { min: Math.ceil(n / 3), max: Math.floor(n / 2) };
}

const clamp = (v: number, { min, max }: { min: number; max: number }) => Math.min(max, Math.max(min, v));

/** 추천 개수: 내용 요소 수 ÷ 2.5 반올림 (2~3개씩 묶는 중간값), 범위 안으로 */
export function recommendedStandardCount(a: Area): number {
  return clamp(Math.round(elementCount(a) / 2.5), standardCountRange(a));
}

/** 교사가 정한 영역별 성취기준 수 (정하지 않았으면 추천 개수, 범위를 벗어나면 범위 안으로) */
export function standardCountsFor(doc: Pick<DesignDoc, "areas" | "standardCounts">): number[] {
  return doc.areas.map((a, i) => {
    const n = doc.standardCounts?.[i];
    return typeof n === "number" && n >= 1 ? clamp(n, standardCountRange(a)) : recommendedStandardCount(a);
  });
}
