import {
  bandInfo,
  bandOfGrade,
  checkAllocation,
  defaultAllocation,
  creativePartsOf,
  withCreativeParts,
  type AllocationInput,
  type AutonomyCourse,
  type BandKey,
  type SemesterIndex,
} from "@/validation/allocation";

/**
 * 학년별 시수 점검 화면.
 * '3학년' 화면 = 지금 3학년 학생들 기준: 3학년(올해) + 4학년(내년)
 * '4학년' 화면 = 지금 4학년 학생들 기준: 3학년(작년) + 4학년(올해)   (5·6학년도 같은 방식)
 * 두 화면 모두 설계 현황의 그 학년군 설계를 기본으로 넣고, 화면마다 따로 고칠 수 있다.
 * 학년군(3·4 또는 5·6)의 두 화면이 모두 '이상없음'이어야 시수 점검 완료.
 */

export const VIEW_GRADES = [3, 4, 5, 6] as const;
export type ViewGrade = (typeof VIEW_GRADES)[number];

/** 저장되는 한 화면의 점검 내용 */
export interface HourCheck {
  grade: ViewGrade;
  /** 화면의 '올해' 학년도 */
  schoolYear: number;
  input: AllocationInput;
  updatedAt?: string;
}

/** 설계 현황의 설계 요약 (시수 점검에 필요한 것만) */
export interface DesignBrief {
  id: string;
  name: string;
  grade: number;
  semester: number;
  hours?: number;
  subjectGroup?: string;
  /** 운영 학년도 (설계 기본 정보) */
  schoolYear?: string | number;
}

/** 학년도별 저장본: 키는 '2027-3' (학년도-학년 화면) */
export type Checks = Record<string, HourCheck>;
export const checkKey = (schoolYear: number, grade: number) => `${schoolYear}-${grade}`;

/** 학년도는 3월에 시작한다 (1~2월은 앞 학년도) */
export function schoolYearOf(date: Date): number {
  return date.getMonth() >= 2 ? date.getFullYear() : date.getFullYear() - 1;
}

export const isViewGrade = (g: number): g is ViewGrade => (VIEW_GRADES as readonly number[]).includes(g);
const yearOfDesign = (d: DesignBrief) => Number(d.schoolYear) || 0;

/** 화면의 4개 학기가 각각 몇 학년도인지 */
export function viewYears(grade: ViewGrade, schoolYear: number): [number, number, number, number] {
  const first = grade % 2 === 1; // 3·5학년 화면: 학년군 첫 학년이 올해
  const y0 = first ? schoolYear : schoolYear - 1;
  return [y0, y0, y0 + 1, y0 + 1];
}

/** 화면의 두 절반: 0 = 첫 학년(1·2학기), 1 = 둘째 학년 */
export function viewHalves(grade: ViewGrade, schoolYear: number): { grade: number; year: number }[] {
  const g = bandInfo(bandOfGrade(grade)).grades;
  const y = viewYears(grade, schoolYear);
  return [
    { grade: g[0], year: y[0] },
    { grade: g[1], year: y[2] },
  ];
}

export function semesterLabelWithYear(grade: ViewGrade, schoolYear: number, s: SemesterIndex): string {
  const band = bandOfGrade(grade);
  const g = bandInfo(band).grades[s < 2 ? 0 : 1];
  return `${g}학년 ${s % 2 === 0 ? 1 : 2}학기 (${viewYears(grade, schoolYear)[s]})`;
}

/** 학년군 안의 짝 화면 (3↔4, 5↔6) */
export const pairGrade = (g: ViewGrade): ViewGrade => (g % 2 === 1 ? g + 1 : g - 1) as ViewGrade;

function subjectFor(band: BandKey, group?: string): string {
  const keys = bandInfo(band).subjects.map((s) => s.key);
  return group && keys.includes(group) ? group : keys[0];
}

/** 이 화면(학년도·학년)에 들어가는 설계: 각 절반의 학년·학년도가 맞는 것만 */
export function designsForView(grade: ViewGrade, schoolYear: number, designs: DesignBrief[]): DesignBrief[] {
  const halves = viewHalves(grade, schoolYear);
  return designs.filter((d) => halves.some((h) => h.grade === d.grade && h.year === yearOfDesign(d)));
}

/** 설계 → 그 학년군의 학교자율시간 목록 (학년으로 학기 위치를 정함) */
export function coursesFromDesigns(band: BandKey, designs: DesignBrief[]): AutonomyCourse[] {
  const grades = bandInfo(band).grades as readonly number[];
  return designs
    .filter((d) => grades.includes(d.grade))
    .map((d) => ({
      name: d.name,
      subjectKey: subjectFor(band, d.subjectGroup),
      semester: (grades.indexOf(d.grade) * 2 + (d.semester === 2 ? 1 : 0)) as SemesterIndex,
      hours: d.hours ?? 0,
      designId: d.id,
    }));
}

// ───── 절반(한 학년 1·2학기) 단위로 다른 화면과 주고받기 ─────
interface HalfData {
  subjects: Record<string, [number, number]>;
  creative: Record<string, [number, number]>;
  courses: { name: string; subjectKey: string; second: boolean; hours: number }[];
}

/** 키 순서와 상관없이 비교되도록 정렬해서 두 학기 값만 */
const pick = (o: Record<string, number[]>, s0: number, s1: number): Record<string, [number, number]> =>
  Object.fromEntries(
    Object.keys(o)
      .sort()
      .map((k) => [k, [o[k][s0], o[k][s1]]]),
  );

function halfData(check: HourCheck, half: 0 | 1): HalfData {
  const a = check.input;
  const [s0, s1] = [half * 2, half * 2 + 1];
  const parts = creativePartsOf(a);
  return {
    subjects: pick(a.subjectHours, s0, s1),
    creative: pick(parts, s0, s1),
    courses: a.courses
      .filter((c) => c.semester === s0 || c.semester === s1)
      .map((c) => ({ name: c.name.trim(), subjectKey: c.subjectKey, second: c.semester === s1, hours: c.hours }))
      .sort((x, y) => (x.name + x.second).localeCompare(y.name + y.second)),
  };
}

const sameHalf = (x: HalfData, y: HalfData) => JSON.stringify(x) === JSON.stringify(y);

/** 이 화면의 절반과 같은 학년·학년도를 담은 다른 저장본 (가장 최근 것) */
function halfSource(check: HourCheck, half: 0 | 1, checks: Checks): { check: HourCheck; half: 0 | 1 } | null {
  const target = viewHalves(check.grade, check.schoolYear)[half];
  const found = Object.values(checks)
    .filter((c) => !(c.grade === check.grade && c.schoolYear === check.schoolYear))
    .flatMap((c) =>
      viewHalves(c.grade, c.schoolYear)
        .map((h, i) => ({ check: c, half: i as 0 | 1, h }))
        .filter((x) => x.h.grade === target.grade && x.h.year === target.year),
    )
    .sort((a, b) => (b.check.updatedAt ?? "").localeCompare(a.check.updatedAt ?? ""));
  return found[0] ? { check: found[0].check, half: found[0].half } : null;
}

/** 다른 저장본의 절반을 이 화면의 절반으로 가져오기 */
function applyHalf(check: HourCheck, half: 0 | 1, src: HourCheck, srcHalf: 0 | 1): HourCheck {
  const a = structuredClone(check.input);
  const b = src.input;
  const [d0, d1] = [half * 2, half * 2 + 1];
  const [s0, s1] = [srcHalf * 2, srcHalf * 2 + 1];
  for (const k of Object.keys(a.subjectHours)) {
    if (!b.subjectHours[k]) continue;
    a.subjectHours[k][d0] = b.subjectHours[k][s0];
    a.subjectHours[k][d1] = b.subjectHours[k][s1];
  }
  const pa = creativePartsOf(a);
  const pb = creativePartsOf(b);
  for (const k of Object.keys(pa) as (keyof typeof pa)[]) {
    pa[k][d0] = pb[k][s0];
    pa[k][d1] = pb[k][s1];
  }
  a.courses = [
    ...a.courses.filter((c) => c.semester !== d0 && c.semester !== d1),
    ...b.courses
      .filter((c) => c.semester === s0 || c.semester === s1)
      .map((c) => ({ ...c, semester: (c.semester === s0 ? d0 : d1) as SemesterIndex })),
  ];
  return { ...check, input: withCreativeParts(a, pa) };
}

/**
 * 처음 여는 화면: 엑셀 기본값 + 그 학년도 설계.
 * 같은 학년·학년도를 이미 점검한 다른 화면이 있으면 그 시수를 그대로 이어받는다.
 * (예: 2027학년도 3학년 점검 → 2028학년도 4학년 화면의 3학년(2027) 부분)
 */
export function initialCheck(grade: ViewGrade, schoolYear: number, designs: DesignBrief[], checks: Checks = {}): HourCheck {
  const band = bandOfGrade(grade);
  let c: HourCheck = { grade, schoolYear, input: { ...defaultAllocation(band), courses: coursesFromDesigns(band, designsForView(grade, schoolYear, designs)) } };
  for (const half of [0, 1] as const) {
    const src = halfSource(c, half, checks);
    if (src) c = applyHalf(c, half, src.check, src.half);
  }
  return c;
}

/** 이전에 점검한 시수와 달라진 절반 (경고만, 막지는 않음) */
export function carryWarnings(check: HourCheck, checks: Checks): { half: 0 | 1; message: string; source: HourCheck; sourceHalf: 0 | 1 }[] {
  return ([0, 1] as const).flatMap((half) => {
    const src = halfSource(check, half, checks);
    if (!src || sameHalf(halfData(check, half), halfData(src.check, src.half))) return [];
    const h = viewHalves(check.grade, check.schoolYear)[half];
    return [
      {
        half,
        source: src.check,
        sourceHalf: src.half,
        message: `${h.grade}학년(${h.year}학년도) 시수가 이전에 점검한 ${src.check.schoolYear}학년도 ${src.check.grade}학년 화면과 달라요.`,
      },
    ];
  });
}

/** 이전 점검 시수로 되돌리기 */
export function restoreHalf(check: HourCheck, half: 0 | 1, source: HourCheck, sourceHalf: 0 | 1): HourCheck {
  return applyHalf(check, half, source, sourceHalf);
}

/** 그 학년도 설계가 없는 절반과, 가져올 수 있는 가장 최근 학년도 설계 */
export function missingHalves(check: HourCheck, designs: DesignBrief[]): { half: 0 | 1; grade: number; year: number; fromYear: number | null }[] {
  return viewHalves(check.grade, check.schoolYear).flatMap((h, i) => {
    if (designs.some((d) => d.grade === h.grade && yearOfDesign(d) === h.year)) return [];
    // 이미 직접 입력했으면 알리지 않는다
    if (check.input.courses.some((c) => Math.floor(c.semester / 2) === i)) return [];
    const years = designs.filter((d) => d.grade === h.grade).map(yearOfDesign).filter((y) => y > 0);
    return [{ half: i as 0 | 1, grade: h.grade, year: h.year, fromYear: years.length ? Math.max(...years) : null }];
  });
}

/** 다른 학년도 설계를 가져와 직접 입력한 줄로 넣기 (그 학년도 설계가 생기면 바꿔 넣으면 됨) */
export function importDesigns(check: HourCheck, half: 0 | 1, fromYear: number, designs: DesignBrief[]): HourCheck {
  const h = viewHalves(check.grade, check.schoolYear)[half];
  const picked = designs.filter((d) => d.grade === h.grade && yearOfDesign(d) === fromYear);
  const added = coursesFromDesigns(check.input.band, picked).map(({ designId: _d, ...c }) => ({ ...c, name: `${c.name} (${fromYear} 설계)` }));
  return { ...check, input: { ...check.input, courses: [...check.input.courses, ...added] } };
}

/** 저장된 점검에 반영되지 않은 설계 변경 (새 설계, 차시·학기·교과가 바뀐 설계, 지워진 설계) */
export function designDiff(check: HourCheck, designs: DesignBrief[]): string[] {
  const band = check.input.band;
  const want = coursesFromDesigns(band, designsForView(check.grade, check.schoolYear, designs));
  const have = check.input.courses.filter((c) => c.designId);
  const out: string[] = [];
  for (const w of want) {
    const h = have.find((c) => c.designId === w.designId);
    if (!h) out.push(`「${w.name}」이(가) 아직 들어가 있지 않아요.`);
    else if (h.hours !== w.hours || h.semester !== w.semester || h.subjectKey !== w.subjectKey || h.name !== w.name)
      out.push(`「${w.name}」의 차시·학기·교과가 설계와 달라요.`);
  }
  for (const h of have) if (!want.some((w) => w.designId === h.designId)) out.push(`「${h.name}」은(는) 설계 현황에서 지워졌거나 다른 학년도예요.`);
  return out;
}

/** 설계 현황 반영: 설계에서 온 것은 지금 설계로 바꾸고, 직접 추가한 것은 그대로 둔다 */
export function syncWithDesigns(check: HourCheck, designs: DesignBrief[]): HourCheck {
  const manual = check.input.courses.filter((c) => !c.designId);
  const fromDesigns = coursesFromDesigns(check.input.band, designsForView(check.grade, check.schoolYear, designs));
  return { ...check, input: { ...check.input, courses: [...fromDesigns, ...manual] } };
}

/** 한 화면이 '이상없음'인지: 계산 오류가 없고 그 학년도 설계와 어긋나지 않음 */
export function checkOk(check: HourCheck | undefined, designs: DesignBrief[]): boolean {
  if (!check) return false;
  return checkAllocation(check.input, viewYears(check.grade, check.schoolYear)).issues.every((i) => i.level !== "error") && designDiff(check, designs).length === 0;
}

export interface BandStatus {
  band: BandKey;
  schoolYear: number;
  /** 이 학년·학년도가 들어 있는 화면이 저장되고 이상없음 */
  complete: boolean;
  /** 이 학년·학년도를 담는 화면 2개 (같은 학년·학기를 담음: 예 2027학년도 5학년 화면 = 2028학년도 6학년 화면). 첫 번째가 기본 화면 */
  views: { grade: ViewGrade; year: number; saved: boolean; ok: boolean }[];
  /** 이상없음인 화면 (편성표 붙임에 씀) */
  okCheck?: HourCheck;
  /** 그 화면의 두 학년(학년도) */
  halves: { grade: number; year: number }[];
  /** 설계가 하나도 없는 절반 (시수 점검에서 직접 입력하거나 가져와야 함) */
  halvesWithoutDesign: { grade: number; year: number }[];
}

/**
 * 설계(학년·학년도)의 시수 점검 완료 여부.
 * 그 설계가 들어가는 화면이 저장되고 이상없음이면 완료. 같은 학년·학기를 담는 짝 화면
 * (3·5학년 화면 Y = 4·6학년 화면 Y+1)도 같은 것으로 본다. 앞 학년 학생들의 다른 화면과는 상관없다.
 */
export function bandStatus(grade: number, schoolYear: number, checks: Checks, designs: DesignBrief[]): BandStatus {
  const band = bandOfGrade(grade);
  const g = grade as ViewGrade;
  const first = (bandInfo(band).grades as readonly number[])[0] === grade;
  const twin = { grade: pairGrade(g), year: first ? schoolYear + 1 : schoolYear - 1 };
  const views = [{ grade: g, year: schoolYear }, twin].map((v) => {
    const c = checks[checkKey(v.year, v.grade)];
    return { ...v, saved: !!c, ok: checkOk(c, designs) };
  });
  const ok = views.find((v) => v.ok);
  const halves = viewHalves(g, schoolYear);
  return {
    band,
    schoolYear,
    complete: !!ok,
    views,
    okCheck: ok ? checks[checkKey(ok.year, ok.grade)] : undefined,
    halves,
    halvesWithoutDesign: halves.filter((h) => !designs.some((d) => d.grade === h.grade && yearOfDesign(d) === h.year)),
  };
}
