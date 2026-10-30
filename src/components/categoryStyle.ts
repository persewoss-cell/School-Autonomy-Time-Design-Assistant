import type { Category } from "@/domain/types";

/** 내용 체계 범주별 색 (지식·이해 빨강, 과정·기능 초록, 가치·태도 보라). 내용 체계 표와 성취기준 내용 요소 칩에서 같이 씀 */
export const CATEGORY_STYLE: Record<Category, { head: string; cell: string; box: string; chipOn: string; chipOff: string; badge: string }> = {
  knowledge: {
    head: "bg-rose-100 text-rose-900",
    cell: "bg-rose-50/70",
    box: "border-rose-200 bg-white hover:border-rose-300",
    chipOn: "border-rose-500 bg-rose-100 font-semibold text-rose-800",
    chipOff: "border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-400",
    badge: "bg-rose-100 text-rose-800",
  },
  process: {
    head: "bg-emerald-100 text-emerald-900",
    cell: "bg-emerald-50/70",
    box: "border-emerald-200 bg-white hover:border-emerald-300",
    chipOn: "border-emerald-500 bg-emerald-100 font-semibold text-emerald-800",
    chipOff: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-400",
    badge: "bg-emerald-100 text-emerald-800",
  },
  values: {
    head: "bg-violet-100 text-violet-900",
    cell: "bg-violet-50/70",
    box: "border-violet-200 bg-white hover:border-violet-300",
    chipOn: "border-violet-500 bg-violet-100 font-semibold text-violet-800",
    chipOff: "border-violet-200 bg-violet-50 text-violet-700 hover:border-violet-400",
    badge: "bg-violet-100 text-violet-800",
  },
};
