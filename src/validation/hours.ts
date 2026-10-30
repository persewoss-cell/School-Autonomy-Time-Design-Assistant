import hours from "@data/rules/curriculum-hours.json";
import type { BasicInfo, Grade, Plan, Unit } from "@/domain/types";
import type { Issue } from "./types";
import { bandOfGrade, maxCoursesPerSemester, semesterAutonomyHours } from "./allocation";

/** 학년별 한 학기 학교자율시간 운영 시수 (3·4학년 29, 5·6학년 32) — 시수 점검 엑셀 계산식 기준 */
export function semesterHours(grade: Grade): number {
  return semesterAutonomyHours(bandOfGrade(grade));
}

/** 학년별 학기당 최대 개설 수 (3·4학년 2개, 5·6학년 3개) */
export function maxCourses(grade: Grade): number {
  return maxCoursesPerSemester(bandOfGrade(grade));
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
  } else if (max - basic.hours >= hours.minHoursPerCourse) {
    // 남는 차시가 1~9이면 checkSemesterBudget이 오류로 알림
    issues.push({
      level: "warning",
      field: "운영 시수",
      message: `${basic.grade}학년 한 학기 학교자율시간은 모두 ${max}시간입니다. 이 ${kind}은 ${basic.hours}시간이므로 같은 학기에 다른 과목/활동으로 ${max - basic.hours}시간을 더 편성해야 합니다.`,
      fix: `이 ${kind}만 운영한다면 ${max}시간으로 맞추고, 여러 개를 운영한다면 합계가 ${max}시간인지 확인하세요. (${basic.grade}학년은 학기당 최대 ${maxCourses(basic.grade)}개)`,
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
  return issues;
}

/** 단원별 차시: 단원마다 1차시 이상, 합계 = 운영 시수 */
export function checkUnitHours(total: number, units: { name: string; hours: number }[]): Issue[] {
  const issues: Issue[] = [];
  if (units.length === 0) return issues;
  units.forEach((u, i) => {
    if (u.hours < 1) {
      issues.push({
        level: "error",
        field: `${i + 1}단원(${u.name})`,
        message: "0차시입니다. 단원마다 차시가 있어야 합니다.",
        fix: "이 단원의 차시를 적고, 그만큼 다른 단원을 줄여 주세요.",
      });
    }
  });
  const sum = units.reduce((s, u) => s + u.hours, 0);
  if (sum !== total) {
    const diff = sum - total;
    issues.push({
      level: "error",
      field: "단원별 차시 합계",
      message: `단원별 차시 합계가 ${sum}차시로, 운영 시수 ${total}차시보다 ${Math.abs(diff)}차시 ${diff > 0 ? "많습니다" : "적습니다"}.`,
      fix: diff > 0 ? `단원 차시를 모두 합쳐 ${diff}차시 줄여 주세요.` : `단원 차시를 모두 합쳐 ${-diff}차시 늘려 주세요.`,
    });
  }
  return issues;
}

/**
 * 같은 학교·학년도·학년·학기에 이미 만든 설계를 생각한 이 설계의 운영 시수 검사.
 * 한 학기 학교자율시간(29/32차시)을 넘으면 안 되고, 하나는 최소 10차시이므로
 * 이 설계 뒤에 남는 차시가 1~9차시이면 그 차시로는 더 만들 수 없어 오류로 막는다. (사용자 결정, 2026-10-31)
 */
export function checkSemesterBudget(
  basic: Pick<BasicInfo, "grade" | "semester" | "hours">,
  others: { name: string; hours: number }[],
): Issue[] {
  const issues: Issue[] = [];
  const max = semesterHours(basic.grade);
  const min = hours.minHoursPerCourse;
  const where = `${basic.grade}학년 ${basic.semester}학기`;
  const used = others.reduce((s, o) => s + o.hours, 0);
  const remaining = max - used;
  const list = others.map((o) => `「${o.name || "이름 없음"}」 ${o.hours}차시`).join(", ") || "없음";
  const field = "같은 학기 다른 설계";
  if (others.length >= maxCourses(basic.grade)) {
    issues.push({
      level: "error",
      field,
      message: `${where}에 이미 ${others.length}개(${list})를 만들었습니다. ${basic.grade}학년은 한 학기에 최대 ${maxCourses(basic.grade)}개까지 개설할 수 있습니다.`,
      fix: "다른 학년·학기를 고르거나, 기존 설계를 삭제해 주세요.",
    });
    return issues;
  }
  if (remaining < min) {
    issues.push({
      level: "error",
      field,
      message: `${where}에는 이미 ${used}차시(${list})를 편성해 ${max}차시 중 ${Math.max(0, remaining)}차시가 남았습니다. 하나는 최소 ${min}차시이므로 더 만들 수 없습니다.`,
      fix: "다른 학년·학기를 고르거나, 기존 설계의 차시를 줄이거나 삭제해 주세요.",
    });
    return issues;
  }
  if (basic.hours > remaining) {
    issues.push({
      level: "error",
      field,
      message: `${where}에는 이미 ${used}차시(${list})를 편성해 ${remaining}차시만 남았습니다. ${basic.hours}차시는 넘칩니다.`,
      fix: `운영 시수를 ${remaining}차시 이하로 줄여 주세요.`,
    });
    return issues;
  }
  const left = remaining - basic.hours;
  if (left > 0 && left < min) {
    const smaller = remaining - min >= min ? ` 또는 ${remaining - min}차시 이하(${min}차시 이상 남김)` : "";
    issues.push({
      level: "error",
      field,
      message: `이렇게 만들면 ${where}에 ${left}차시가 남는데, ${min}차시 미만이라 그 차시로는 과목/활동을 더 만들 수 없습니다. (이미 편성: ${list})`,
      fix: `운영 시수를 ${remaining}차시(남는 차시 없이)${smaller}로 정해 주세요.`,
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
  if (courses.length > maxCourses(grade)) {
    issues.push({
      level: "error",
      field: "학기 개설 수",
      message: `한 학기에 ${courses.length}개를 개설했습니다. ${grade}학년은 학기당 최대 ${maxCourses(grade)}개까지 가능합니다.`,
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
