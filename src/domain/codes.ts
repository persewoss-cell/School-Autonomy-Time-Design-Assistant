import type { Application, Area, BasicInfo, Category, DesignDoc, Standard } from "./types";

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * 성취기준 코드: [편성학년][편성교과 맨 앞 글자][과목명 약어][영역 순서 2자리]-[영역 내 순서 2자리]
 * 예: [6사지구촌02-01]  (2027 지침 변경 형식)
 * 2026학년도까지 운영한 설계는 편성교과 글자 없이 [학년][약어][영역]-[순서] (예: [3디탐01-01]) — 2027 지침부터 적용 (사용자 확인, 2026-10-31)
 */
export const CODE_WITH_GROUP_FROM = 2027;

export function standardCode(basic: Pick<BasicInfo, "grade" | "subjectGroup">, abbrev: string, standards: Standard[], std: Standard, startYear?: string): string {
  const order = standards.filter((s) => s.areaIndex === std.areaIndex).findIndex((s) => s.id === std.id) + 1;
  const year = Number(startYear);
  const group = year && year < CODE_WITH_GROUP_FROM ? "" : basic.subjectGroup.charAt(0);
  return `[${basic.grade}${group}${abbrev}${pad2(std.areaIndex + 1)}-${pad2(order)}]`;
}

/** application이 있으면 운영 학년도에 따라 코드 형식을 정한다 (2026학년도까지는 편성교과 글자 없음) */
export function codeMap(doc: Pick<DesignDoc, "basic" | "abbrev" | "standards"> & { application?: Pick<Application, "startYear"> }): Map<string, string> {
  return new Map(doc.standards.map((s) => [s.id, standardCode(doc.basic, doc.abbrev, doc.standards, s, doc.application?.startYear)]));
}

/** 내용 요소 문구가 어느 범주에 속하는지 (내용 체계에서 찾음) */
export function categoryOf(areas: Area[], element: string): Category | null {
  const norm = (s: string) => s.replace(/\s+/g, "").replace(/^[·⋅∙•▫-]+/, "");
  const target = norm(element);
  for (const a of areas) {
    if (a.knowledge.some((e) => norm(e) === target)) return "knowledge";
    if (a.process.some((e) => norm(e) === target)) return "process";
    if (a.values.some((e) => norm(e) === target)) return "values";
  }
  return null;
}

/** 성취기준이 결합한 범주 (AI가 아니라 연결한 내용 요소로 코드가 계산) */
export function standardCategories(areas: Area[], std: Standard): Category[] {
  const set = new Set<Category>();
  for (const e of std.elements) {
    const c = categoryOf(areas, e);
    if (c) set.add(c);
  }
  return [...set];
}

/** 같은 범주의 내용 요소가 2개 이상 함께 묶였는지 (성취기준은 서로 다른 범주끼리 묶는다) */
export function hasSameCategory(areas: Area[], elements: string[]): boolean {
  const cats = elements.map((e) => categoryOf(areas, e)).filter((c): c is Category => c !== null);
  return new Set(cats).size < cats.length;
}

/** 단원 지도계획: n번째 단원은 n번째 영역의 성취기준만 다룬다 */
export const areaStandardIds = (doc: Pick<DesignDoc, "standards">, areaIndex: number): string[] =>
  doc.standards.filter((s) => s.areaIndex === areaIndex).map((s) => s.id);
