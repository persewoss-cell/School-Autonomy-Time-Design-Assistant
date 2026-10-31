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
 * - 증감 범위는 지침 26쪽대로 교과(군) 단위로 본다 (국어, 사회/도덕, 수학, 과학/실과, 체육, 음악/미술, 영어)
 *   체육, 예술(음악/미술)은 교과(군) 기준시수보다 줄일 수 없다 (음악·미술은 교과군 합계로 봄, 사용자 확인 2026-10-31)
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
  /** 창체 학기별 합계 (= 아래 세 영역의 합) */
  creativeHours: FourSemesters;
  /** 창체 영역별 학기 시수: 자율·자치활동 / 동아리활동 / 진로활동 (예전 저장본에는 없을 수 있음) */
  creativeParts?: CreativeParts;
  courses: AutonomyCourse[];
}

export const CREATIVE_PARTS = [
  ["self", "자율·자치활동"],
  ["club", "동아리활동"],
  ["career", "진로활동"],
] as const;
export type CreativePart = (typeof CREATIVE_PARTS)[number][0];
export type CreativeParts = Record<CreativePart, FourSemesters>;

/** 창체 영역별 시수 (예전 저장본은 모두 자율·자치활동으로 봄) */
export function creativePartsOf(a: AllocationInput): CreativeParts {
  return a.creativeParts ?? { self: [...a.creativeHours] as FourSemesters, club: [0, 0, 0, 0], career: [0, 0, 0, 0] };
}

/** 창체 영역 시수를 바꾸고 학기 합계를 다시 계산 */
export function withCreativeParts(a: AllocationInput, parts: CreativeParts): AllocationInput {
  const sum = [0, 1, 2, 3].map((s) => parts.self[s] + parts.club[s] + parts.career[s]) as FourSemesters;
  return { ...a, creativeParts: parts, creativeHours: sum };
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

/** 교과(군) 점검 결과 (증감 범위는 교과군 단위) */
export interface GroupResult extends RowResult {
  /** 이 교과군에 속한 교과 */
  keys: string[];
}

export interface AllocationResult {
  /** 교과별 (min·max는 그 교과군의 범위, ok는 교과군 범위 + 감축 불가 교과 여부) */
  rows: RowResult[];
  groups: GroupResult[];
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

/**
 * 학기당 최대 개설 수: 지침의 '최대 3개'와 '1개당 10시간 이상'을 함께 적용.
 * 3~4학년은 한 학기 29시간이라 10시간짜리 3개(30시간)가 안 되므로 최대 2개, 5~6학년(32시간)은 3개.
 */
export function maxCoursesPerSemester(band: BandKey): number {
  return Math.min(data.maxCoursesPerSemester, Math.floor(semesterAutonomyHours(band) / data.minHoursPerCourse));
}

/** 엑셀 기본값으로 채운 입력 (교과 시수는 기준시수를 4학기에 고르게 나눔) */
export function defaultAllocation(band: BandKey): AllocationInput {
  const b = data.bands[band];
  const split = (base: number): FourSemesters => {
    const q = Math.floor(base / 4);
    const r = base - q * 4;
    return [q + (r > 0 ? 1 : 0), q + (r > 2 ? 1 : 0), q + (r > 1 ? 1 : 0), q];
  };
  const base: AllocationInput = {
    band,
    baseHours: Object.fromEntries(b.subjects.map((s) => [s.key, s.baseHours])),
    creativeBaseHours: b.creativeBaseHours,
    subjectHours: Object.fromEntries(b.subjects.map((s) => [s.key, split(s.baseHours)])),
    creativeHours: split(b.creativeBaseHours),
    courses: [],
  };
  // 창체 기본값: 동아리 학기당 10시간, 진로 1학기 3·2학기 5시간, 나머지는 자율·자치 (학교에서 고쳐 씀)
  const club: FourSemesters = [10, 10, 10, 10];
  const career: FourSemesters = [3, 5, 3, 5];
  const total = split(b.creativeBaseHours);
  return withCreativeParts(base, { self: total.map((t, i) => t - club[i] - career[i]) as FourSemesters, club, career });
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

/**
 * 학년도별 학교자율시간 운영 의무 (사용자 확인, 2026-10-31)
 * - 2024학년도까지: 학교자율시간 적용 전 → 의무 없음
 * - 2025학년도: 학교당 1개 이상 (다른 학년군 화면에서 운영할 수 있어 학년별로는 따지지 않음)
 * - 2026학년도: 3~4학년군에서 1개, 5~6학년군에서 1개 (같은 학년도의 다른 학년은 다른 화면에 있어 확인 필요로만 알림)
 * - 2027학년도부터: 3~6학년 학년별로 1개 이상 (오류)
 */
export const AUTONOMY_FROM = { school: 2025, band: 2026, grade: 2027 } as const;

export function checkAllocation(input: AllocationInput, years?: readonly number[]): AllocationResult {
  const b = data.bands[input.band];
  const issues: Issue[] = [];

  const subjectRows = b.subjects.map((s) => {
    const base = input.baseHours[s.key] ?? s.baseHours;
    const own = sum4(input.subjectHours[s.key] ?? [0, 0, 0, 0]);
    const autonomy = input.courses.filter((c) => c.subjectKey === s.key).reduce((t, c) => t + c.hours, 0);
    return row(s.key, base, own + autonomy, autonomy, s.noReduction);
  });

  // 교과(군)별 증감 범위 (지침 26쪽)
  const groupNames = [...new Set(b.subjects.map((s) => s.group))];
  const groups: GroupResult[] = groupNames.map((g) => {
    const keys = b.subjects.filter((s) => s.group === g).map((s) => s.key);
    const mine = subjectRows.filter((r) => keys.includes(r.label));
    const noReduction = b.subjects.some((s) => s.group === g && s.noReduction);
    const gr = row(
      g,
      mine.reduce((t, r) => t + r.baseHours, 0),
      mine.reduce((t, r) => t + r.planned, 0),
      mine.reduce((t, r) => t + r.autonomy, 0),
      noReduction,
    );
    return { ...gr, keys };
  });
  const rows = subjectRows.map((r) => {
    const g = groups.find((x) => x.keys.includes(r.label))!;
    return { ...r, min: g.min, max: g.max, ok: g.ok };
  });

  const subtotalBase = subjectRows.reduce((t, r) => t + r.baseHours, 0);
  const subtotal = row("교과 소계", subtotalBase, subjectRows.reduce((t, r) => t + r.planned, 0), subjectRows.reduce((t, r) => t + r.autonomy, 0));
  const creative = row("창의적 체험활동", input.creativeBaseHours, sum4(input.creativeHours), 0);
  const totalBase = subtotalBase + input.creativeBaseHours;
  const totalPlanned = subtotal.planned + creative.planned;
  const total = { baseHours: totalBase, planned: totalPlanned, ok: totalBase === totalPlanned };

  for (const r of [...groups, subtotal, creative]) {
    if (r.ok) continue;
    const noReduction = "keys" in r && b.subjects.some((s) => s.group === r.label && s.noReduction);
    if (r.planned < r.min) {
      issues.push({
        level: "error",
        field: r.label,
        message: noReduction
          ? `${r.label}은(는) 기준시수(${r.baseHours}시간)보다 줄일 수 없습니다. 현재 편성시수는 ${r.planned}시간입니다. (학교자율시간 포함)`
          : `${r.label} 편성시수 ${r.planned}시간이 교과(군) 증감 범위(${r.min}~${r.max}시간)보다 ${r.min - r.planned}시간 적습니다.`,
        fix: noReduction
          ? `${r.label} 시수를 ${r.min - r.planned}시간 늘리거나, 학교자율시간을 이 교과에 편성해 채워 주세요.`
          : `${r.label} 시수를 ${r.min - r.planned}시간 이상 늘려 주세요.`,
      });
    } else {
      issues.push({
        level: "error",
        field: r.label,
        message: `${r.label} 편성시수 ${r.planned}시간이 ${"keys" in r ? "교과(군) " : ""}증감 범위(${r.min}~${r.max}시간)를 ${r.planned - r.max}시간 넘습니다.`,
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

  // 학기별 학교자율시간 (지침: 학기 단위 운영, 학년별 한 학기 이상, 학기당 3개 이내(3~4학년은 10시간 조건 때문에 2개), 1개당 10시간 이상)
  const target = semesterAutonomyHours(input.band);
  const maxCourses = maxCoursesPerSemester(input.band);
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
    if (count > maxCourses) {
      issues.push({
        level: "error",
        field: `${label} 학교자율시간`,
        message: `${label}에 ${count}개를 개설했습니다. ${b.label}은 학기당 최대 ${maxCourses}개까지 가능합니다.${maxCourses < data.maxCoursesPerSemester ? ` (한 학기 ${target}시간에 1개당 10시간 이상)` : ""}`,
        fix: "과목/활동 수를 줄여 주세요.",
      });
    }
  });
  b.grades.forEach((g, gi) => {
    if (bySem[gi * 2] !== 0 || bySem[gi * 2 + 1] !== 0) return;
    // 학년도를 모르면(예전 호출) 2027 지침대로 본다
    const year = years?.[gi * 2] ?? AUTONOMY_FROM.grade;
    if (year >= AUTONOMY_FROM.grade) {
      issues.push({
        level: "error",
        field: `${g}학년 학교자율시간`,
        message: `${g}학년에 학교자율시간이 없습니다. 2027학년도부터 3~6학년은 학년별로 한 학기 이상 운영해야 합니다.`,
        fix: `${g}학년 1학기 또는 2학기에 ${target}시간을 편성해 주세요.`,
      });
    } else if (year >= AUTONOMY_FROM.band) {
      issues.push({
        level: "warning",
        field: `${g}학년(${year}) 학교자율시간`,
        message: `${year}학년도에는 ${b.label}에서 1개 이상 운영하면 됩니다. 같은 학년도의 ${b.label} 다른 학년에서 운영하는지 확인해 주세요.`,
        fix: `${b.label} 다른 학년의 ${year}학년도 화면에 학교자율시간이 있는지 확인해 주세요.`,
      });
    }
    // 2025학년도(학교당 1개)·2024학년도 이전(적용 전)은 학년별로 따지지 않음
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

  return { rows, groups, subtotal, creative, total, autonomyBySemester: bySem, semesterTarget: target, issues };
}

/** 학교자율시간을 운영하는 학기에서 교과·창체를 '1주 수업시간'만큼 줄여 주는 도움 기능 */
export function autoReduce(a: AllocationInput): AllocationInput {
  const base = defaultAllocation(a.band);
  let next: AllocationInput = { ...a, subjectHours: base.subjectHours, creativeHours: base.creativeHours };
  // 창체 동아리·진로는 학교가 정한 값을 두고, 자율·자치에서 줄인다
  const kept = creativePartsOf(a);
  const parts: CreativeParts = {
    club: [...kept.club] as FourSemesters,
    career: [...kept.career] as FourSemesters,
    self: base.creativeHours.map((t, i) => t - kept.club[i] - kept.career[i]) as FourSemesters,
  };
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
    parts.self[s] -= cw;
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
  next = withCreativeParts(next, parts);
  return next;
}
