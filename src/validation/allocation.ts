import data from "@data/rules/curriculum-hours.json";
import type { Issue } from "./types";

/**
 * 학교자율시간 시수 편성 점검 — '학교자율시간 시수 편성 점검표' 엑셀의 계산식을 그대로 옮긴 것.
 *
 * 엑셀 계산식
 * - 1주 수업시간 = (기준시수 ÷ 34) ÷ 2
 * - 증감범위 하한 = ROUNDUP(기준시수 × 0.8)  (체육·음악·미술은 ROUNDUP(기준시수) = 감축 불가)
 * - 증감범위 상한 = ROUNDDOWN(기준시수 × 1.2)
 * - 편성시수 = 교과 편성시수 + 그 교과에 편성한 학교자율시간 시수
 * - 교과 소계·창체도 같은 범위로 점검, 총시수는 기준 총시수와 같아야 함
 */

export type BandKey = keyof typeof data.bands; // "3-4" | "5-6"

export interface SubjectRule {
  key: string;
  group: string;
  baseHours: number;
  noReduction?: boolean;
}

/** 학년군 안의 4개 학기: 0=첫 학년 1학기, 1=첫 학년 2학기, 2=둘째 학년 1학기, 3=둘째 학년 2학기 */
export type SemesterIndex = 0 | 1 | 2 | 3;
export type FourSemesters = [number, number, number, number];

export interface AutonomyCourse {
  name: string;
  /** 편성한 교과 (예: "사회") */
  subjectKey: string;
  semester: SemesterIndex;
  hours: number;
  /** 설계 현황에서 가져온 것이면 그 설계 id (직접 추가한 것은 없음) */
  designId?: string;
}

export interface AllocationInput {
  band: BandKey;
  /** 교과별 기준시수 (엑셀 1번: 해당 학년의 기준시수 입력. 기본값은 엑셀 값) */
  baseHours: Record<string, number>;
  creativeBaseHours: number;
  /** 교과별 학기 편성시수 (학교자율시간 제외) */
  subjectHours: Record<string, FourSemesters>;
  creativeHours: FourSemesters;
  courses: AutonomyCourse[];
}

export interface RowResult {
  label: string;
  baseHours: number;
  oneWeek: number;
  min: number;
  max: number;
  planned: number;
  autonomy: number;
  ok: boolean;
}

export interface AllocationResult {
  rows: RowResult[];
  subtotal: RowResult;
  creative: RowResult;
  total: { baseHours: number; planned: number; ok: boolean };
  /** 학기별 학교자율시간 합계 */
  autonomyBySemester: FourSemesters;
  /** 학기별 학교자율시간 운영 시수 (= 총 수업 시간 수 1주 분량) */
  semesterTarget: number;
  issues: Issue[];
}

export function bandInfo(band: BandKey) {
  return data.bands[band];
}

export function bandOfGrade(grade: number): BandKey {
  return grade <= 4 ? "3-4" : "5-6";
}

export function semesterLabel(band: BandKey, s: SemesterIndex): string {
  const g = data.bands[band].grades[s < 2 ? 0 : 1];
  return `${g}학년 ${s % 2 === 0 ? 1 : 2}학기`;
}

const sum4 = (a: readonly number[]) => a.reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0);

export const oneWeekHours = (base: number) => base / data.weeksPerYear / 2;
export const rangeMin = (base: number, noReduction = false) =>
  Math.ceil(noReduction ? base : base * (1 - data.rangeRate));
export const rangeMax = (base: number) => Math.floor(base * (1 + data.rangeRate));

/** 기준 총시수에서 계산한 한 학기 학교자율시간 시수 (3~4학년 29, 5~6학년 32) */
export function semesterAutonomyHours(band: BandKey): number {
  const b = data.bands[band];
  const total = b.subjects.reduce((s, x) => s + x.baseHours, 0) + b.creativeBaseHours;
  return Math.floor(oneWeekHours(total));
}

/** 엑셀 기본값으로 채운 입력 (교과 시수는 기준시수를 4학기에 고르게 나눔) */
export function defaultAllocation(band: BandKey): AllocationInput {
  const b = data.bands[band];
  const split = (base: number): FourSemesters => {
    const q = Math.floor(base / 4);
    const r = base - q * 4;
    return [q + (r > 0 ? 1 : 0), q + (r > 2 ? 1 : 0), q + (r > 1 ? 1 : 0), q];
  };
  return {
    band,
    baseHours: Object.fromEntries(b.subjects.map((s) => [s.key, s.baseHours])),
    creativeBaseHours: b.creativeBaseHours,
    subjectHours: Object.fromEntries(b.subjects.map((s) => [s.key, split(s.baseHours)])),
    creativeHours: split(b.creativeBaseHours),
    courses: [],
  };
}

function row(label: string, base: number, planned: number, autonomy: number, noReduction = false): RowResult {
  const min = rangeMin(base, noReduction);
  const max = rangeMax(base);
  return {
    label,
    baseHours: base,
    oneWeek: oneWeekHours(base),
    min,
    max,
    planned,
    autonomy,
    ok: planned >= min && planned <= max,
  };
}

export function checkAllocation(input: AllocationInput): AllocationResult {
  const b = data.bands[input.band];
  const issues: Issue[] = [];

  const rows = b.subjects.map((s) => {
    const base = input.baseHours[s.key] ?? s.baseHours;
    const own = sum4(input.subjectHours[s.key] ?? [0, 0, 0, 0]);
    const autonomy = input.courses.filter((c) => c.subjectKey === s.key).reduce((t, c) => t + c.hours, 0);
    return row(s.key, base, own + autonomy, autonomy, s.noReduction);
  });

  const subtotalBase = rows.reduce((t, r) => t + r.baseHours, 0);
  const subtotal = row("교과 소계", subtotalBase, rows.reduce((t, r) => t + r.planned, 0), rows.reduce((t, r) => t + r.autonomy, 0));
  const creative = row("창의적 체험활동", input.creativeBaseHours, sum4(input.creativeHours), 0);
  const totalBase = subtotalBase + input.creativeBaseHours;
  const totalPlanned = subtotal.planned + creative.planned;
  const total = { baseHours: totalBase, planned: totalPlanned, ok: totalBase === totalPlanned };

  for (const r of [...rows, subtotal, creative]) {
    if (r.ok) continue;
    const rule = b.subjects.find((s) => s.key === r.label);
    if (r.planned < r.min) {
      issues.push({
        level: "error",
        field: r.label,
        message: rule?.noReduction
          ? `${r.label}은(는) 기준시수(${r.baseHours}시간)보다 줄일 수 없습니다. 현재 편성시수는 ${r.planned}시간입니다. (학교자율시간 포함)`
          : `${r.label} 편성시수 ${r.planned}시간이 증감 범위(${r.min}~${r.max}시간)보다 ${r.min - r.planned}시간 적습니다.`,
        fix: rule?.noReduction
          ? `${r.label} 시수를 ${r.min - r.planned}시간 늘리거나, 학교자율시간을 ${r.label} 교과에 편성해 채워 주세요.`
          : `${r.label} 시수를 ${r.min - r.planned}시간 이상 늘려 주세요.`,
      });
    } else {
      issues.push({
        level: "error",
        field: r.label,
        message: `${r.label} 편성시수 ${r.planned}시간이 증감 범위(${r.min}~${r.max}시간)를 ${r.planned - r.max}시간 넘습니다.`,
        fix: `${r.label} 시수를 ${r.planned - r.max}시간 이상 줄이거나, 학교자율시간을 다른 교과에 편성해 주세요.`,
      });
    }
  }
  if (!total.ok) {
    const d = totalPlanned - totalBase;
    issues.push({
      level: "error",
      field: "학년군 총 수업 시간 수",
      message: `총 편성시수 ${totalPlanned}시간이 기준 ${totalBase}시간과 ${Math.abs(d)}시간 ${d > 0 ? "많습니다" : "적습니다"}.`,
      fix:
        d > 0
          ? `학교자율시간을 편성한 만큼 교과·창체 시수를 ${d}시간 줄여 주세요. (교과별 '1주 수업시간'만큼 줄이는 것을 권장)`
          : `교과·창체 시수를 ${-d}시간 늘려 주세요.`,
    });
  }

  // 학기별 학교자율시간 (지침: 학기 단위 운영, 학년별 한 학기 이상, 학기당 3개 이내, 1개당 10시간 이상)
  const target = semesterAutonomyHours(input.band);
  const bySem = [0, 1, 2, 3].map((s) =>
    input.courses.filter((c) => c.semester === s).reduce((t, c) => t + c.hours, 0),
  ) as FourSemesters;
  bySem.forEach((h, s) => {
    const label = semesterLabel(input.band, s as SemesterIndex);
    const count = input.courses.filter((c) => c.semester === s).length;
    if (h !== 0 && h !== target) {
      issues.push({
        level: "error",
        field: `${label} 학교자율시간`,
        message: `${label} 학교자율시간 합계가 ${h}시간입니다. 운영하는 학기는 ${target}시간(1주 분량)이어야 합니다.`,
        fix: h < target ? `${target - h}시간을 더 편성해 주세요.` : `${h - target}시간을 줄여 주세요.`,
      });
    }
    if (count > data.maxCoursesPerSemester) {
      issues.push({
        level: "error",
        field: `${label} 학교자율시간`,
        message: `${label}에 ${count}개를 개설했습니다. 학기당 최대 ${data.maxCoursesPerSemester}개까지 가능합니다.`,
        fix: "과목/활동 수를 줄여 주세요.",
      });
    }
  });
  b.grades.forEach((g, gi) => {
    if (bySem[gi * 2] === 0 && bySem[gi * 2 + 1] === 0) {
      issues.push({
        level: "error",
        field: `${g}학년 학교자율시간`,
        message: `${g}학년에 학교자율시간이 없습니다. 3~6학년은 학년별로 한 학기 이상 운영해야 합니다.`,
        fix: `${g}학년 1학기 또는 2학기에 ${target}시간을 편성해 주세요.`,
      });
    }
  });
  input.courses.forEach((c) => {
    if (c.hours < data.minHoursPerCourse) {
      issues.push({
        level: "error",
        field: c.name || "이름 없는 과목/활동",
        message: `${c.hours}시간입니다. 한 과목/활동은 최소 ${data.minHoursPerCourse}시간 이상이어야 합니다.`,
        fix: `${data.minHoursPerCourse}시간 이상으로 늘려 주세요.`,
      });
    }
    if (!b.subjects.some((s) => s.key === c.subjectKey)) {
      issues.push({
        level: "error",
        field: c.name || "이름 없는 과목/활동",
        message: `편성 교과 '${c.subjectKey}'은(는) ${b.label}에 없는 교과입니다.`,
        fix: "편성 교과를 다시 골라 주세요.",
      });
    }
  });

  return { rows, subtotal, creative, total, autonomyBySemester: bySem, semesterTarget: target, issues };
}

/** 학교자율시간을 운영하는 학기에서 교과·창체를 '1주 수업시간'만큼 줄여 주는 도움 기능 */
export function autoReduce(a: AllocationInput): AllocationInput {
  const base = defaultAllocation(a.band);
  const next: AllocationInput = { ...a, subjectHours: base.subjectHours, creativeHours: base.creativeHours };
  const subjects = bandInfo(a.band).subjects;
  for (const s of [0, 1, 2, 3] as SemesterIndex[]) {
    const need = a.courses.filter((c) => c.semester === s).reduce((t, c) => t + c.hours, 0);
    if (need === 0) continue;
    let cut = 0;
    for (const sub of subjects) {
      if (sub.noReduction) continue; // 체육·음악·미술은 감축 불가
      const w = Math.floor(oneWeekHours(a.baseHours[sub.key] ?? sub.baseHours));
      next.subjectHours[sub.key][s] -= w;
      cut += w;
    }
    const cw = Math.floor(oneWeekHours(a.creativeBaseHours));
    next.creativeHours[s] -= cw;
    cut += cw;
    // 모자라는 시수는 국어 → 수학 순서로 추가 감축 (넘치면 되돌림)
    const order = ["국어", "수학", "영어", "사회"];
    let k = 0;
    while (cut !== need && k < 500) {
      const key = order[k % order.length];
      if (next.subjectHours[key]) next.subjectHours[key][s] += cut > need ? 1 : -1;
      cut += cut > need ? -1 : 1;
      k++;
    }
  }
  return next;
}
