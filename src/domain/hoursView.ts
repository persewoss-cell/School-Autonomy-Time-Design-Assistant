import {
  bandInfo,
  bandOfGrade,
  checkAllocation,
  defaultAllocation,
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
}

/** 학년도는 3월에 시작한다 (1~2월은 앞 학년도) */
export function schoolYearOf(date: Date): number {
  return date.getMonth() >= 2 ? date.getFullYear() : date.getFullYear() - 1;
}

export const isViewGrade = (g: number): g is ViewGrade => (VIEW_GRADES as readonly number[]).includes(g);

/** 화면의 4개 학기가 각각 몇 학년도인지 */
export function viewYears(grade: ViewGrade, schoolYear: number): [number, number, number, number] {
  const first = grade % 2 === 1; // 3·5학년 화면: 학년군 첫 학년이 올해
  const y0 = first ? schoolYear : schoolYear - 1;
  return [y0, y0, y0 + 1, y0 + 1];
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

/** 설계 현황 → 그 학년군의 학교자율시간 목록 */
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

/** 처음 여는 화면: 엑셀 기본값 + 설계 현황의 학교자율시간 */
export function initialCheck(grade: ViewGrade, schoolYear: number, designs: DesignBrief[]): HourCheck {
  const band = bandOfGrade(grade);
  return { grade, schoolYear, input: { ...defaultAllocation(band), courses: coursesFromDesigns(band, designs) } };
}

/** 저장된 점검에 반영되지 않은 설계 변경 (새 설계, 차시·학기·교과가 바뀐 설계, 지워진 설계) */
export function designDiff(check: HourCheck, designs: DesignBrief[]): string[] {
  const band = check.input.band;
  const want = coursesFromDesigns(band, designs);
  const have = check.input.courses.filter((c) => c.designId);
  const out: string[] = [];
  for (const w of want) {
    const h = have.find((c) => c.designId === w.designId);
    if (!h) out.push(`「${w.name}」이(가) 아직 들어가 있지 않아요.`);
    else if (h.hours !== w.hours || h.semester !== w.semester || h.subjectKey !== w.subjectKey || h.name !== w.name)
      out.push(`「${w.name}」의 차시·학기·교과가 설계와 달라요.`);
  }
  for (const h of have) if (!want.some((w) => w.designId === h.designId)) out.push(`「${h.name}」은(는) 설계 현황에서 지워졌어요.`);
  return out;
}

/** 설계 현황 반영: 설계에서 온 것은 지금 설계로 바꾸고, 직접 추가한 것은 그대로 둔다 */
export function syncWithDesigns(check: HourCheck, designs: DesignBrief[]): HourCheck {
  const manual = check.input.courses.filter((c) => !c.designId);
  return { ...check, input: { ...check.input, courses: [...coursesFromDesigns(check.input.band, designs), ...manual] } };
}

/** 한 화면이 '이상없음'인지: 계산 오류가 없고 설계 현황과 어긋나지 않음 */
export function checkOk(check: HourCheck | undefined, designs: DesignBrief[]): boolean {
  if (!check) return false;
  return checkAllocation(check.input).issues.every((i) => i.level !== "error") && designDiff(check, designs).length === 0;
}

export interface BandStatus {
  band: BandKey;
  complete: boolean;
  /** 화면별 상태 */
  views: { grade: ViewGrade; saved: boolean; ok: boolean }[];
  /** 설계가 하나도 없는 학년 (시수 점검에서 직접 입력해야 함) */
  gradesWithoutDesign: number[];
}

/** 학년군 시수 점검 완료 여부: 두 학년 화면 모두 저장되고 이상없음이어야 완료 */
export function bandStatus(grade: number, checks: Partial<Record<ViewGrade, HourCheck>>, designs: DesignBrief[]): BandStatus {
  const band = bandOfGrade(grade);
  const grades = bandInfo(band).grades as readonly number[];
  const views = grades.map((g) => {
    const vg = g as ViewGrade;
    return { grade: vg, saved: !!checks[vg], ok: checkOk(checks[vg], designs) };
  });
  return {
    band,
    complete: views.every((v) => v.ok),
    views,
    gradesWithoutDesign: grades.filter((g) => !designs.some((d) => d.grade === g)),
  };
}
