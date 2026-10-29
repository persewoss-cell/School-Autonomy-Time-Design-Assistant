import hours from "@data/rules/curriculum-hours.json";
import type { BasicInfo, Grade, Plan, Unit } from "@/domain/types";
import type { Issue } from "./types";
import { bandOfGrade, semesterAutonomyHours } from "./allocation";

/** 학년별 한 학기 학교자율시간 운영 시수 (3·4학년 29, 5·6학년 32) — 시수 점검 엑셀 계산식 기준 */
export function semesterHours(grade: Grade): number {
  return semesterAutonomyHours(bandOfGrade(grade));
}

export function totalLessonHours(units: Unit[]): number {
  return units.reduce((sum, u) => sum + u.lessons.reduce((s, l) => s + l.hours, 0), 0);
}

/** 차시 번호 붙이기: 1차시짜리는 "1/29", 2차시 이상은 "2~3/29" */
export function lessonLabels(units: { lessons: { hours: number }[] }[], total: number): string[][] {
  let next = 1;
  return units.map((u) =>
    u.lessons.map((l) => {
      const start = next;
      const end = next + l.hours - 1;
      next = end + 1;
      return start === end ? `${start}/${total}` : `${start}~${end}/${total}`;
    }),
  );
}

/** 기본 정보의 운영 시수 검사 */
export function checkBasicHours(basic: Pick<BasicInfo, "grade" | "hours" | "type">): Issue[] {
  const issues: Issue[] = [];
  const max = semesterHours(basic.grade);
  const kind = basic.type === "subject" ? "과목" : "활동";
  if (basic.hours < hours.minHoursPerCourse) {
    issues.push({
      level: "error",
      field: "운영 시수",
      message: `한 ${kind}은 최소 ${hours.minHoursPerCourse}차시 이상 운영해야 합니다. (현재 ${basic.hours}시간)`,
      fix: `운영 시수를 ${hours.minHoursPerCourse}시간 이상으로 늘려 주세요.`,
    });
  }
  if (basic.hours > max) {
    issues.push({
      level: "error",
      field: "운영 시수",
      message: `${basic.grade}학년의 한 학기 학교자율시간은 ${max}시간입니다. ${basic.hours}시간은 넘칩니다.`,
      fix: `운영 시수를 ${max}시간 이하로 줄여 주세요.`,
    });
  } else if (basic.hours < max) {
    issues.push({
      level: "warning",
      field: "운영 시수",
      message: `${basic.grade}학년 한 학기 학교자율시간은 모두 ${max}시간입니다. 이 ${kind}은 ${basic.hours}시간이므로 같은 학기에 다른 과목/활동으로 ${max - basic.hours}시간을 더 편성해야 합니다.`,
      fix: `이 ${kind}만 운영한다면 ${max}시간으로 맞추고, 여러 개를 운영한다면 합계가 ${max}시간인지 확인하세요. (학기당 최대 ${hours.maxCoursesPerSemester}개)`,
    });
  }
  return issues;
}

/** 단원 지도계획의 차시 합계·구성 검사 */
export function checkPlanHours(plan: Plan, basic: Pick<BasicInfo, "hours">): Issue[] {
  const issues: Issue[] = [];
  const total = totalLessonHours(plan.units);
  if (total !== basic.hours) {
    const diff = total - basic.hours;
    issues.push({
      level: "error",
      field: "단원 지도계획 차시 합계",
      message: `차시 합계가 ${total}시간으로, 운영 시수 ${basic.hours}시간과 ${Math.abs(diff)}시간 ${diff > 0 ? "넘칩니다" : "모자랍니다"}.`,
      fix: diff > 0 ? `차시를 ${diff}시간 줄여 주세요.` : `차시를 ${-diff}시간 늘려 주세요.`,
    });
  }
  plan.units.forEach((u, ui) => {
    if (u.lessons.length === 0) {
      issues.push({
        level: "error",
        field: `${ui + 1}단원`,
        message: "차시가 하나도 없습니다.",
        fix: "차시를 추가하거나 단원을 삭제해 주세요.",
      });
    }
  });
  const hasAssessment = plan.units.some((u) => u.lessons.some((l) => l.assessment.trim() !== ""));
  if (!hasAssessment) {
    issues.push({
      level: "warning",
      field: "과정중심평가",
      message: "단원 지도계획에 [과정중심평가] 표시가 없습니다. 지침상 평가 계획의 평가 내용은 단원 지도계획에 반드시 포함해야 합니다.",
      fix: "평가할 차시의 '평가' 칸에 평가 내용을 적어 주세요.",
    });
  }
  return issues;
}

/** 같은 학년·학기에 편성한 여러 과목/활동의 합계 검사 */
export function checkSemesterTotal(
  grade: Grade,
  courses: { name: string; hours: number }[],
): Issue[] {
  const issues: Issue[] = [];
  const max = semesterHours(grade);
  if (courses.length > hours.maxCoursesPerSemester) {
    issues.push({
      level: "error",
      field: "학기 개설 수",
      message: `한 학기에 ${courses.length}개를 개설했습니다. 학기당 최대 ${hours.maxCoursesPerSemester}개까지 가능합니다.`,
      fix: "과목/활동 수를 줄이거나 다른 학기로 옮겨 주세요.",
    });
  }
  const sum = courses.reduce((s, c) => s + c.hours, 0);
  if (sum !== max) {
    issues.push({
      level: "error",
      field: "학기 시수 합계",
      message: `${grade}학년 한 학기 학교자율시간 합계가 ${sum}시간입니다. ${max}시간이어야 합니다.`,
      fix: sum > max ? `${sum - max}시간을 줄여 주세요.` : `${max - sum}시간을 더 편성해 주세요.`,
    });
  }
  for (const c of courses) {
    if (c.hours < hours.minHoursPerCourse) {
      issues.push({
        level: "error",
        field: c.name,
        message: `${c.name}은(는) ${c.hours}시간입니다. 최소 ${hours.minHoursPerCourse}시간 이상이어야 합니다.`,
        fix: `${hours.minHoursPerCourse}시간 이상으로 늘려 주세요.`,
      });
    }
  }
  return issues;
}
