"use client";

import { useMemo, useState } from "react";

/**
 * 표 정렬: 제목 칸의 세모를 누를 때마다 기본(검은 ▼) → 오름차순(파란 ▼) → 내림차순(빨간 ▲) → 기본.
 * key는 열 이름, get은 그 열의 정렬 값.
 */
export type SortDir = "none" | "asc" | "desc";

export function useSort<T>(rows: T[], getters: Record<string, (r: T) => string | number>, defaultOrder?: (a: T, b: T) => number) {
  const [sort, setSort] = useState<{ key: string; dir: SortDir }>({ key: "", dir: "none" });
  const sorted = useMemo(() => {
    // 기본(세모를 안 눌렀을 때) 순서
    if (sort.dir === "none" || !getters[sort.key]) return defaultOrder ? [...rows].sort(defaultOrder) : rows;
    const get = getters[sort.key];
    const out = [...rows].sort((a, b) => {
      const x = get(a);
      const y = get(b);
      return typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "ko");
    });
    return sort.dir === "desc" ? out.reverse() : out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sort]);
  const toggle = (key: string) =>
    setSort((s) => (s.key !== key ? { key, dir: "asc" } : { key, dir: s.dir === "none" ? "asc" : s.dir === "asc" ? "desc" : "none" }));
  const dirOf = (key: string): SortDir => (sort.key === key ? sort.dir : "none");
  return { sorted, toggle, dirOf };
}

/** 정렬 세모가 붙은 제목 칸 */
export function SortTh({ label, k, sort, className = "" }: { label: string; k: string; sort: { toggle: (k: string) => void; dirOf: (k: string) => SortDir }; className?: string }) {
  const dir = sort.dirOf(k);
  return (
    <th className={`p-2 ${className}`}>
      <button type="button" onClick={() => sort.toggle(k)} className="inline-flex items-center gap-1 whitespace-nowrap hover:text-gray-800" title="눌러서 정렬">
        {label}
        <span className={`text-[10px] ${dir === "asc" ? "text-blue-600" : dir === "desc" ? "text-red-600" : "text-gray-900"}`}>{dir === "desc" ? "▲" : "▼"}</span>
      </button>
    </th>
  );
}

/** 설계 표 기본 순서: 학년도 내림차순, 같은 학년도 안에서는 마지막 저장 내림차순 (사용자 결정, 2026-10-31) */
export const byYearThenSaved = (a: { schoolYear?: string; updatedAt: string }, b: { schoolYear?: string; updatedAt: string }) =>
  (b.schoolYear ?? "").localeCompare(a.schoolYear ?? "") || b.updatedAt.localeCompare(a.updatedAt);
