import {
  bandInfo,
  checkAllocation,
  creativePartsOf,
  CREATIVE_PARTS,
  type AllocationInput,
  type CreativePart,
  type SemesterIndex,
} from "@/validation/allocation";

/**
 * '( )학년 교육과정 편성표' 양식(학교 제공 PDF)의 줄 구성. 시수 점검 화면과 .docx 편성표가 같이 쓴다.
 * 구분(교과·교과군·교과) | 기준시수(±범위) | 증감범위 | 학년별 [배당 | 1학기 증감·편성 | 2학기 증감·편성 | 계] | 학년군 합계
 */

export type FormLine =
  | { kind: "subject"; key: string; base: number; hours: [number, number, number, number] }
  | { kind: "course"; index: number; name: string; semester: SemesterIndex; hours: number }
  /** 양식에만 있는 빈 줄 (3~4학년 '실과') */
  | { kind: "placeholder"; name: string };

export interface FormGroup {
  /** 교과군 이름 (양식 표기: 과학/실과, 예술 등) */
  label: string;
  /** 줄이 하나뿐이고 교과명이 같아 교과군·교과 칸을 합침 (수학, 영어) */
  merged: boolean;
  base: number;
  /** ±범위 (감축 불가 교과군은 +) */
  delta: number;
  noReduction: boolean;
  min: number;
  max: number;
  planned: number;
  ok: boolean;
  lines: FormLine[];
}

export interface FormModel {
  grades: [number, number];
  groups: FormGroup[];
  subtotal: { base: number; planned: number; ok: boolean };
  creative: { base: number; delta: number; min: number; max: number; planned: number; ok: boolean; parts: { key: CreativePart; name: string; hours: [number, number, number, number] }[] };
  total: { base: number; planned: number; ok: boolean };
  /** 학기별 교과 편성 합계 (학교자율시간 포함) */
  subjectSem: [number, number, number, number];
  creativeSem: [number, number, number, number];
}

/** 양식에서 교과군·교과 칸을 합쳐 쓰는 교과 */
const MERGED = ["수학", "영어"];
const DISPLAY: Record<string, string> = { "음악/미술": "예술" };

export function formModel(a: AllocationInput): FormModel {
  const info = bandInfo(a.band);
  const r = checkAllocation(a);
  const groups: FormGroup[] = r.groups.map((g) => {
    const lines: FormLine[] = g.keys.flatMap((k): FormLine[] => [
      { kind: "subject", key: k, base: a.baseHours[k] ?? info.subjects.find((s) => s.key === k)!.baseHours, hours: [...(a.subjectHours[k] ?? [0, 0, 0, 0])] as [number, number, number, number] },
      ...a.courses.flatMap((c, i): FormLine[] => (c.subjectKey === k ? [{ kind: "course", index: i, name: c.name || "학교자율시간", semester: c.semester, hours: c.hours }] : [])),
    ]);
    let label = DISPLAY[g.label] ?? g.label;
    // 3~4학년은 실과가 없지만 양식처럼 '과학/실과' 아래 빈 실과 줄을 둔다
    if (a.band === "3-4" && g.label === "과학") {
      label = "과학/실과";
      lines.push({ kind: "placeholder", name: "실과" });
    }
    const noReduction = g.keys.some((k) => info.subjects.find((s) => s.key === k)?.noReduction);
    return {
      label,
      merged: lines.length === 1 && MERGED.includes(g.label),
      base: g.baseHours,
      delta: g.max - g.baseHours,
      noReduction,
      min: g.min,
      max: g.max,
      planned: g.planned,
      ok: g.ok,
      lines,
    };
  });
  const parts = creativePartsOf(a);
  const sems = [0, 1, 2, 3] as SemesterIndex[];
  const subjectSem = sems.map(
    (s) => info.subjects.reduce((t, x) => t + (a.subjectHours[x.key]?.[s] ?? 0), 0) + a.courses.filter((c) => c.semester === s).reduce((t, c) => t + c.hours, 0),
  ) as [number, number, number, number];
  return {
    grades: [info.grades[0], info.grades[1]],
    groups,
    subtotal: { base: r.subtotal.baseHours, planned: r.subtotal.planned, ok: r.subtotal.ok },
    creative: {
      base: a.creativeBaseHours,
      delta: r.creative.max - a.creativeBaseHours,
      min: r.creative.min,
      max: r.creative.max,
      planned: r.creative.planned,
      ok: r.creative.ok,
      parts: CREATIVE_PARTS.map(([key, name]) => ({ key, name, hours: [...parts[key]] as [number, number, number, number] })),
    },
    total: { base: r.total.baseHours, planned: r.total.planned, ok: r.total.ok },
    subjectSem,
    creativeSem: [...a.creativeHours] as [number, number, number, number],
  };
}

/** 증감 표기: 0이면 빈칸, 양수는 + */
export const signed = (v: number) => (v === 0 ? "" : v > 0 ? `+${v}` : String(v));
/** 세로 글자 (양식의 '국/어', '사/회///도/덕' 처럼 한 글자씩) */
export const vertical = (s: string) => [...s.replace(/\s/g, "")];
