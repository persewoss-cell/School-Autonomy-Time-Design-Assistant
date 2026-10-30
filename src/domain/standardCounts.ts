import { CATEGORIES, CATEGORY_KEYS, type Area, type Category, type DesignDoc } from "./types";

/** 영역의 범주별 내용 요소 수 (빈칸 제외) */
export const categoryCounts = (a: Area): Record<Category, number> => ({
  knowledge: a.knowledge.filter((s) => s.trim()).length,
  process: a.process.filter((s) => s.trim()).length,
  values: a.values.filter((s) => s.trim()).length,
});

/** 영역의 내용 요소 수 (빈칸 제외) */
export const elementCount = (a: Area) => Object.values(categoryCounts(a)).reduce((x, y) => x + y, 0);

/**
 * 내용 요소를 서로 다른 범주끼리 2~3개씩 묶을 수 없는 이유 (묶을 수 있으면 null).
 * 한 범주의 내용 요소가 나머지 두 범주를 합한 것보다 많으면 같은 범주끼리 묶어야 해서 안 된다.
 */
export function splitProblem(a: Area): string | null {
  const counts = categoryCounts(a);
  const n = elementCount(a);
  if (n < 2) return `내용 요소가 ${n}개뿐이라 성취기준을 만들 수 없습니다.`;
  const top = CATEGORY_KEYS.reduce((x, y) => (counts[y] > counts[x] ? y : x));
  if (counts[top] > n - counts[top]) {
    return `${CATEGORIES[top]} 내용 요소(${counts[top]}개)가 나머지 두 범주를 합한 수(${n - counts[top]}개)보다 많아, 서로 다른 범주끼리 묶을 수 없습니다.`;
  }
  return null;
}

/**
 * 영역별 성취기준 수의 범위.
 * 성취기준 하나는 서로 다른 범주의 내용 요소 2~3개를 묶고(범주마다 1개까지), 내용 요소 하나는 성취기준 하나에만 들어가므로
 * 내용 요소 n개를 모두 나누면 최소 max(⌈n÷3⌉, 가장 많은 범주의 내용 요소 수)개, 최대 ⌊n÷2⌋개.
 */
export function standardCountRange(a: Area): { min: number; max: number } {
  const n = elementCount(a);
  const max = Math.max(1, Math.floor(n / 2));
  const min = Math.max(1, Math.ceil(n / 3), ...Object.values(categoryCounts(a)));
  return { min: Math.min(min, max), max };
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

/**
 * 성취기준 k개가 각각 묶을 범주 조합 (예: 지식·이해 2, 과정·기능 2, 가치·태도 2개를 2개로 → [세 범주, 세 범주]).
 * 3개짜리는 세 범주 모두, 2개짜리는 서로 다른 두 범주. 묶을 수 없으면 null.
 */
export function categorySplit(a: Area, k: number): Category[][] | null {
  const counts = categoryCounts(a);
  const n = elementCount(a);
  if (splitProblem(a) || k < 1 || 2 * k > n || 3 * k < n || CATEGORY_KEYS.some((c) => counts[c] > k)) return null;
  // 2개짜리 성취기준(3k − n개)마다 빠지는 범주: 범주 c는 (k − c의 내용 요소 수)번 빠진다
  const missing = CATEGORY_KEYS.flatMap((c) => Array<Category>(k - counts[c]).fill(c));
  return Array.from({ length: k }, (_, i) => CATEGORY_KEYS.filter((c) => c !== missing[i]));
}
