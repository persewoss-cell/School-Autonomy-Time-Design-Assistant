import { unitHoursFor } from "./unitHours";
import { newId, type Area, type AssessmentRow, type DesignDoc, type Plan, type Standard, type Teaching } from "./types";

/**
 * 'AI 없이 직접 입력하기': 단계마다 교사가 채울 빈칸 틀.
 * 앞 단계에서 정한 것(영역 수·영역명·성취기준·단원별 차시)은 그대로 살린다.
 */

/** 내용 체계: [전단계]의 영역 수·영역명대로, 없으면 2개 */
export function manualAreas(doc: Pick<DesignDoc, "input">): Area[] {
  const names = doc.input.areaNames;
  const count = Math.max(doc.input.areaCount ?? 0, names.length, names.length ? 0 : 2);
  return Array.from({ length: count }, (_, i) => ({ name: names[i] ?? "", knowledge: [""], process: [""], values: [""] }));
}

/** 핵심아이디어: 영역 수만큼 (영역 수 ≒ 핵심아이디어 수) */
export function manualCoreIdeas(doc: Pick<DesignDoc, "areas">): string[] {
  return Array.from({ length: Math.max(1, doc.areas.length) }, () => "");
}

/** 성취기준: 영역마다 정해 둔 개수(없으면 2개) */
export function manualStandards(doc: Pick<DesignDoc, "areas" | "standardCounts">): Standard[] {
  return doc.areas.flatMap((_, areaIndex) =>
    Array.from({ length: Math.max(1, doc.standardCounts?.[areaIndex] ?? 2) }, () => ({ id: newId(), areaIndex, text: "", elements: [] })),
  );
}

/** hours를 n칸에 고르게 (앞쪽에 1씩 더) */
const split = (hours: number, n: number) => Array.from({ length: n }, (_, i) => Math.floor(hours / n) + (i < hours % n ? 1 : 0));

/** 단원 지도계획: 영역 = 단원, 단원별 차시대로, 성취기준마다 차시 한 줄 */
export function manualPlan(doc: Pick<DesignDoc, "areas" | "basic" | "planRequest" | "standards">): Plan {
  const hours = unitHoursFor(doc);
  return {
    title: "직접 작성",
    concept: "",
    units: doc.areas.map((a, i) => {
      const ids = doc.standards.filter((s) => s.areaIndex === i).map((s) => s.id);
      const h = Math.max(1, hours[i] ?? 1);
      const rows = Math.max(1, Math.min(ids.length, h));
      return {
        unitName: a.name,
        standardIds: ids,
        lessons: split(h, rows).map((n, k) => ({ hours: n, topic: "", goal: "", activities: [""], assessment: "", assessFor: ids[k] ?? "", inputActivities: [], note: "" })),
      };
    }),
  };
}

/** 평가 계획: 성취기준마다 한 줄 */
export function manualAssessments(doc: Pick<DesignDoc, "standards">): AssessmentRow[] {
  return doc.standards.map((s) => ({ month: "", standardIds: [s.id], focus: "", levels: { A: "", B: "", C: "" }, methods: [] }));
}

/** 교수·학습 및 평가: 항목마다 빈 줄 하나 */
export const manualTeaching = (): Teaching => ({ teachingDirection: [""], teachingMethods: [""], assessDirection: [""], assessMethods: [""] });
