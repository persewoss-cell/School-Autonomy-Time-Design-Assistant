import type { DesignDoc } from "./types";
import { elementCount } from "./standardCounts";

/** 단원 하나의 최소 차시 (사용자 결정, 2026-10-30: 단원별 10차시 이상) */
export const MIN_UNIT_HOURS = 10;

/**
 * total 시간을 가중치(내용 요소 수) 비율로 나눈다. 모두 MIN_UNIT_HOURS 이상이 되게 먼저 10씩 주고 나머지를 나눈다.
 * (total이 모자라면 비율대로만 나눔) 큰 나머지 순으로 1씩 더해 합계를 정확히 맞춘다.
 */
function distribute(total: number, weights: number[]): number[] {
  const n = weights.length;
  if (n === 0) return [];
  const base = total >= MIN_UNIT_HOURS * n ? MIN_UNIT_HOURS : 0;
  const rest = Math.max(0, total - base * n);
  const w = weights.map((x) => Math.max(1, x));
  const sum = w.reduce((a, b) => a + b, 0);
  const exact = w.map((x) => (rest * x) / sum);
  const out = exact.map((x) => base + Math.floor(x));
  let left = total - out.reduce((a, b) => a + b, 0);
  const order = exact.map((x, i) => ({ i, r: x - Math.floor(x) })).sort((a, b) => b.r - a.r || a.i - b.i);
  for (let k = 0; left > 0; k = (k + 1) % n, left--) out[order[k].i] += 1;
  return out;
}

/** 추천 단원별 차시: 단원(=영역)마다 10차시씩, 남는 차시는 내용 요소 수 비율로 */
export function recommendedUnitHours(doc: Pick<DesignDoc, "areas" | "basic">): number[] {
  return distribute(doc.basic.hours, doc.areas.map(elementCount));
}

/** 교사가 정한 단원별 차시 (빈칸은 남은 차시를 추천 방식으로 나눠 채움) */
export function unitHoursFor(doc: Pick<DesignDoc, "areas" | "basic" | "planRequest">): number[] {
  const set = doc.areas.map((_, i) => {
    const v = doc.planRequest?.unitHours?.[i];
    return typeof v === "number" && v >= 1 ? v : null;
  });
  const blanks = set.flatMap((v, i) => (v === null ? [i] : []));
  if (blanks.length === doc.areas.length) return recommendedUnitHours(doc);
  const rest = Math.max(0, doc.basic.hours - set.reduce<number>((a, v) => a + (v ?? 0), 0));
  const fill = distribute(rest, blanks.map((i) => elementCount(doc.areas[i])));
  return set.map((v, i) => v ?? fill[blanks.indexOf(i)]);
}
