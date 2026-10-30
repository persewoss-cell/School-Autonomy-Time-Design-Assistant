import type { Area, BasicInfo, Category, DesignDoc, Standard } from "./types";

const pad2 = (n: number) => String(n).padStart(2, "0");

/** 과목명에서 약어 기본값 (공백·기호 빼고 앞 2글자) */
export function defaultAbbrev(name: string): string {
  return name.replace(/[^가-힣A-Za-z0-9]/g, "").slice(0, 2);
}

/**
 * 성취기준 코드: [편성학년][편성교과 맨 앞 글자][과목명 약어][영역 순서 2자리]-[영역 내 순서 2자리]
 * 예: [6사지구촌02-01]  (2027 지침 변경 형식)
 */
export function standardCode(basic: Pick<BasicInfo, "grade" | "subjectGroup">, abbrev: string, standards: Standard[], std: Standard): string {
  const order = standards.filter((s) => s.areaIndex === std.areaIndex).findIndex((s) => s.id === std.id) + 1;
  return `[${basic.grade}${basic.subjectGroup.charAt(0)}${abbrev}${pad2(std.areaIndex + 1)}-${pad2(order)}]`;
}

export function codeMap(doc: Pick<DesignDoc, "basic" | "abbrev" | "standards">): Map<string, string> {
  return new Map(doc.standards.map((s) => [s.id, standardCode(doc.basic, doc.abbrev, doc.standards, s)]));
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
