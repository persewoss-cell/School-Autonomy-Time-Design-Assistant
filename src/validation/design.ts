import { CATEGORIES, DESIGN_TYPES, type Area, type DesignDoc } from "@/domain/types";
import { codeMap, standardCategories } from "@/domain/codes";
import { checklistFor } from "@/domain/checklist";
import { checkBasicHours, checkPlanHours } from "./hours";
import type { Issue, StepKey } from "./types";

/**
 * 설계 문서 단계별 검증. 근거: docs/guideline-summary.md
 * (지침 「2027학년도 초등 학교자율시간 설계·운영 지침」 + 2027 설계·운영 역량강화 연수 PPT)
 */

const VERB_ENDINGS = /(하기|알기|보기|찾기|만들기|쓰기|읽기|기르기|갖기|가지기|익히기|살펴보기)$/;
const SENTENCE_END = /다\.?$/;
const VALUE_WORDS = ["태도", "흥미", "인식", "자세", "가치관", "감수성", "실천", "배려", "존중", "민감성", "내면화", "즐거움", "호기심", "관용", "효능감", "창의성", "자기존중", "어울림", "향유", "의지", "책임감", "의식", "마음"];

const clean = (s: string) => s.trim().replace(/[.\s]+$/, "");
const tag = (step: StepKey, issues: Issue[]) => issues.map((i) => ({ ...i, step }));

/** ③ 내용 체계: 영역 2~3개, 범주별 서술어미 (PPT 44~46쪽) */
export function checkContentSystem(areas: Area[]): Issue[] {
  const issues: Issue[] = [];
  if (areas.length === 0) {
    issues.push({ level: "error", field: "내용 체계", message: "영역이 하나도 없습니다.", fix: "영역을 2~3개 만들어 주세요." });
    return tag("content", issues);
  }
  if (areas.length < 2 || areas.length > 3) {
    issues.push({
      level: "warning",
      field: "영역 수",
      message: `영역이 ${areas.length}개입니다. 영역은 2~3개를 권장합니다.`,
      fix: "영역을 2~3개로 조정해 보세요.",
    });
  }
  areas.forEach((a, i) => {
    const where = `${i + 1}영역${a.name ? `(${a.name})` : ""}`;
    if (!a.name.trim()) {
      issues.push({ level: "error", field: `${i + 1}영역 이름`, message: "영역 이름이 비어 있습니다.", fix: "영역 이름을 명사형으로 적어 주세요." });
    }
    (["knowledge", "process", "values"] as const).forEach((c) => {
      const items = a[c].map((e) => e.trim()).filter(Boolean);
      if (items.length === 0) {
        issues.push({
          level: "error",
          field: `${where} ${CATEGORIES[c]}`,
          message: `${CATEGORIES[c]} 내용 요소가 없습니다.`,
          fix: `${CATEGORIES[c]} 내용 요소를 1개 이상 적어 주세요.`,
        });
      }
      for (const e of items) {
        const t = clean(e);
        if (c === "knowledge" && (VERB_ENDINGS.test(t) || SENTENCE_END.test(e.trim()))) {
          issues.push({
            level: "warning",
            field: `${where} 지식·이해`,
            message: `'${e}' — 지식·이해는 명사형으로 씁니다.`,
            fix: "예: (X) 평화의 중요성 알기 → (O) 평화의 중요성",
          });
        }
        if (c === "process" && !/기$/.test(t)) {
          issues.push({
            level: "warning",
            field: `${where} 과정·기능`,
            message: `'${e}' — 과정·기능은 '~하기'로 끝맺습니다.`,
            fix: "예: 탐구하기, 자료수집하기, 비교·분석하기, 발표하기, 제작하기 …",
          });
        }
        if (c === "values" && (VERB_ENDINGS.test(t) || SENTENCE_END.test(e.trim()))) {
          issues.push({
            level: "warning",
            field: `${where} 가치·태도`,
            message: `'${e}' — 가치·태도는 명사형으로 씁니다.`,
            fix: `주된 종결어: ${VALUE_WORDS.slice(0, 12).join(", ")} 등`,
          });
        }
      }
    });
  });
  return tag("content", issues);
}

/** ④ 핵심아이디어: 영역 수와 비슷하게, 당위 표현 지양 (PPT 47쪽, 예시 문서 메모) */
export function checkCoreIdeas(ideas: string[], areaCount: number): Issue[] {
  const issues: Issue[] = [];
  const list = ideas.map((s) => s.trim()).filter(Boolean);
  if (list.length === 0) {
    return tag("coreIdeas", [{ level: "error", field: "핵심아이디어", message: "핵심아이디어가 없습니다.", fix: "학습을 통해 일반화할 수 있는 진술문을 1개 이상 적어 주세요." }]);
  }
  if (areaCount > 0 && list.length !== areaCount) {
    issues.push({
      level: "warning",
      field: "핵심아이디어 수",
      message: `핵심아이디어가 ${list.length}개, 영역이 ${areaCount}개입니다. 영역의 수 ≒ 핵심아이디어의 수가 권장됩니다.`,
      fix: "영역마다 핵심아이디어가 하나씩 대응하도록 조정해 보세요.",
    });
  }
  list.forEach((s, i) => {
    if (/(해야|하여야|되어야|돼야|야)\s*한다/.test(s)) {
      issues.push({
        level: "warning",
        field: `핵심아이디어 ${i + 1}`,
        message: "'~해야 한다'와 같은 당위적 표현은 지양합니다.",
        fix: "사실·개념을 일반화한 진술문으로 바꿔 주세요. 예: 문화는 예술을 통하여 가치와 신념이 표현된다.",
      });
    }
    if (!SENTENCE_END.test(s)) {
      issues.push({ level: "warning", field: `핵심아이디어 ${i + 1}`, message: "진술문은 '~다.'로 끝맺습니다.", fix: "문장 끝을 '~다.'로 바꿔 주세요." });
    }
  });
  return tag("coreIdeas", issues);
}

/** ⑤ 성취기준: 코드 형식, 범주 2개 이상 결합, 내용 요소 연계, 영역별 2개 이상 (지침 20·17쪽, PPT 48~49쪽) */
export function checkStandards(doc: Pick<DesignDoc, "basic" | "abbrev" | "areas" | "standards">): Issue[] {
  const issues: Issue[] = [];
  if (!/^[가-힣A-Za-z]{2,3}$/.test(doc.abbrev)) {
    issues.push({
      level: "error",
      field: "성취기준 코드 약어",
      message: `과목명 약어 '${doc.abbrev}'가 올바르지 않습니다. 과목명 앞 글자 또는 요약 2~3자여야 합니다.`,
      fix: "예: 지구마을 첫걸음 → 지구, 지구촌, 함께 걷는 우리 → 지구촌",
    });
  }
  if (doc.standards.length === 0) {
    issues.push({ level: "error", field: "성취기준", message: "성취기준이 없습니다.", fix: "영역별로 2개 이상 성취기준을 만들어 주세요." });
    return tag("standards", issues);
  }
  const codes = codeMap(doc);
  doc.areas.forEach((a, i) => {
    const n = doc.standards.filter((s) => s.areaIndex === i).length;
    if (n < 2) {
      issues.push({
        level: "warning",
        field: `${i + 1}영역(${a.name}) 성취기준`,
        message: `이 영역의 성취기준이 ${n}개입니다. 영역별로 2가지 이상 개발을 권장합니다.`,
        fix: "성취기준을 추가해 주세요.",
      });
    }
  });
  // 내용 요소 하나는 성취기준 하나에만, 내용 요소는 빠짐없이
  const owner = new Map<string, string>();
  for (const s of doc.standards) {
    for (const e of s.elements) {
      const prev = owner.get(e);
      if (prev && prev !== s.id) {
        issues.push({
          level: "error",
          field: `내용 요소 '${e}'`,
          message: `${codes.get(prev)}와(과) ${codes.get(s.id)}에 겹쳐 들어가 있습니다. 내용 요소 하나는 성취기준 하나에만 넣습니다.`,
          fix: "한쪽 성취기준에서 이 내용 요소를 빼 주세요.",
        });
      } else owner.set(e, s.id);
    }
  }
  doc.areas.forEach((a, i) => {
    const unused = [...a.knowledge, ...a.process, ...a.values].map((e) => e.trim()).filter((e) => e && !owner.has(e));
    if (unused.length && doc.standards.some((s) => s.areaIndex === i)) {
      issues.push({
        level: "warning",
        field: `${i + 1}영역(${a.name}) 내용 요소`,
        message: `어느 성취기준에도 연결되지 않은 내용 요소가 있습니다: ${unused.join(", ")}`,
        fix: "성취기준에 연결하거나, 필요 없으면 내용 체계에서 빼 주세요.",
      });
    }
  });
  const seen = new Set<string>();
  for (const s of doc.standards) {
    const code = codes.get(s.id) ?? "";
    if (s.areaIndex < 0 || s.areaIndex >= doc.areas.length) {
      issues.push({ level: "error", field: code, message: "연결된 영역이 없습니다.", fix: "성취기준의 영역을 다시 골라 주세요." });
    }
    if (!s.text.trim()) {
      issues.push({ level: "error", field: code, message: "성취기준 문장이 비어 있습니다.", fix: "문장을 적거나 이 성취기준을 삭제해 주세요." });
      continue;
    }
    if (seen.has(s.text.trim())) {
      issues.push({ level: "error", field: code, message: "같은 문장의 성취기준이 이미 있습니다.", fix: "도달점이 겹치지 않게 고쳐 주세요." });
    }
    seen.add(s.text.trim());
    if (!SENTENCE_END.test(s.text.trim())) {
      issues.push({ level: "warning", field: code, message: "성취기준은 '~한다.', '~할 수 있다.'처럼 '~다.'로 끝맺습니다.", fix: "문장 끝을 고쳐 주세요." });
    }
    if (s.elements.length === 0) {
      issues.push({
        level: "error",
        field: code,
        message: "연결된 내용 요소가 없습니다. 성취기준은 내용 체계의 내용 요소와 연계해야 합니다.",
        fix: "이 성취기준이 다루는 내용 요소를 골라 주세요.",
      });
      continue;
    }
    if (s.elements.length === 1 || s.elements.length > 3) {
      issues.push({
        level: "warning",
        field: code,
        message: `내용 요소가 ${s.elements.length}개 연결되어 있습니다. 성취기준 하나에 내용 요소 2~3개를 묶는 것을 권장합니다.`,
        fix: "내용 요소를 2~3개가 되도록 조정해 주세요.",
      });
    }
    const cats = standardCategories(doc.areas, s);
    if (cats.length < 2) {
      issues.push({
        level: "warning",
        field: code,
        message:
          cats[0] === "knowledge"
            ? "[지식·이해] 범주만으로 진술하는 것은 지양합니다."
            : "세 범주(지식·이해 / 과정·기능 / 가치·태도) 중 두 가지 이상을 결합해 진술하는 것을 권장합니다.",
        fix: "다른 범주의 내용 요소를 함께 연결하고 문장에 반영해 주세요.",
      });
    }
  }
  return tag("standards", issues);
}

/** ⑥ 필요성(성격) 및 목표: 총괄 목표 + 세부 목표 3개 */
export function checkIntro(doc: Pick<DesignDoc, "basic" | "intro">): Issue[] {
  const issues: Issue[] = [];
  const label = doc.basic.type === "subject" ? "성격" : "필요성";
  const r = doc.intro.rationale.trim();
  if (!r) {
    issues.push({ level: "error", field: label, message: `${label}이 비어 있습니다.`, fix: `${label}을 작성해 주세요.` });
  } else if (r.length < 150) {
    issues.push({
      level: "warning",
      field: label,
      message: `${label}이 짧습니다. (${r.length}자)`,
      fix:
        doc.basic.type === "subject"
          ? "과목의 고유 성격 + 필요성 및 역할 + 기르고자 하는 역량을 담아 주세요."
          : "사회현상 및 시대적 요구 + 배워야 하는 까닭 + 기르고자 하는 학생상·역량을 담아 주세요.",
    });
  }
  if (!doc.intro.overallGoal.trim()) {
    issues.push({ level: "error", field: "총괄 목표", message: "총괄 목표가 비어 있습니다.", fix: "학습의 도달점을 총괄 목표로 적어 주세요." });
  }
  ["지식·이해", "과정·기능", "가치·태도"].forEach((c, i) => {
    if (!doc.intro.detailGoals[i]?.trim()) {
      issues.push({ level: "error", field: `세부 목표(${c})`, message: `${c} 세부 목표가 비어 있습니다.`, fix: "세부 목표 3가지를 모두 적어 주세요." });
    }
  });
  return tag("intro", issues);
}

/** ⑦ 단원 지도계획: 시수 + 성취기준 배치 */
export function checkUnitPlan(doc: Pick<DesignDoc, "basic" | "abbrev" | "standards" | "plan">): Issue[] {
  const plan = doc.plan.selected;
  if (!plan) {
    return tag("plan", [{ level: "error", field: "단원 지도계획", message: "단원 지도계획을 아직 정하지 않았습니다.", fix: "3안 중 하나를 골라 주세요." }]);
  }
  const issues: Issue[] = [...checkBasicHours(doc.basic), ...checkPlanHours(plan, doc.basic)];
  const codes = codeMap(doc);
  const used = new Set(plan.units.flatMap((u) => u.standardIds));
  plan.units.forEach((u, i) => {
    if (u.standardIds.filter((id) => codes.has(id)).length === 0) {
      issues.push({ level: "error", field: `${i + 1}단원(${u.unitName}) 성취기준`, message: "이 단원에 배치한 성취기준이 없습니다.", fix: "단원에 맞는 성취기준을 골라 주세요." });
    }
  });
  for (const s of doc.standards) {
    if (!used.has(s.id)) {
      issues.push({
        level: "error",
        field: codes.get(s.id) ?? "성취기준",
        message: "이 성취기준이 어느 단원에도 배치되지 않았습니다.",
        fix: "알맞은 단원에 성취기준을 배치해 주세요.",
      });
    }
  }
  return tag("plan", issues);
}

/** ⑧ 평가 계획: 성취수준 A·B·C, 방법, 단원 지도계획에 평가 내용 포함 */
export function checkAssessments(doc: Pick<DesignDoc, "basic" | "abbrev" | "standards" | "plan" | "assessments">): Issue[] {
  const issues: Issue[] = [];
  const codes = codeMap(doc);
  if (doc.assessments.length === 0) {
    return tag("assessment", [{ level: "error", field: "평가 계획", message: "평가 계획이 없습니다.", fix: "성취기준별 평가 계획을 작성해 주세요." }]);
  }
  doc.assessments.forEach((a, i) => {
    const f = `평가 계획 ${i + 1}`;
    if (a.standardIds.filter((id) => codes.has(id)).length === 0) {
      issues.push({ level: "error", field: f, message: "평가할 성취기준을 고르지 않았습니다.", fix: "성취기준을 1개 이상(최대 2개 묶음 가능) 골라 주세요." });
    }
    if (!a.month.trim()) issues.push({ level: "warning", field: f, message: "평가 시기가 비어 있습니다.", fix: "평가 내용에 알맞은 월을 적어 주세요." });
    if (!a.focus.trim()) issues.push({ level: "error", field: f, message: "수업·평가 방법, 연계의 주안점이 비어 있습니다.", fix: "평가 내용을 양식에 맞춰 적어 주세요." });
    (["A", "B", "C"] as const).forEach((lv) => {
      if (!a.levels[lv].trim()) issues.push({ level: "error", field: f, message: `성취수준 ${lv}가 비어 있습니다.`, fix: "성취수준 A·B·C를 모두 적어 주세요." });
    });
    if (a.methods.filter((m) => m.trim()).length === 0) {
      issues.push({ level: "error", field: f, message: "평가 방법을 고르지 않았습니다.", fix: "예: 관찰평가, 자기평가, 동료평가, 산출물평가 …" });
    }
    // 평가 계획의 평가 내용은 단원 지도계획에 반드시 포함 (예시 문서 메모, PPT 51쪽)
    const plan = doc.plan.selected;
    if (plan) {
      const units = plan.units.filter((u) => u.standardIds.some((id) => a.standardIds.includes(id)));
      if (units.length > 0 && !units.some((u) => u.lessons.some((l) => l.assessment.trim()))) {
        issues.push({
          level: "error",
          field: f,
          message: "이 평가 내용이 단원 지도계획에 들어 있지 않습니다. 평가 계획의 평가 내용은 단원 지도계획에 반드시 포함해야 합니다.",
          fix: "단원 지도계획에서 평가할 차시의 '[과정중심평가]' 칸에 평가 내용을 적어 주세요.",
        });
      }
    }
  });
  const covered = new Set(doc.assessments.flatMap((a) => a.standardIds));
  for (const s of doc.standards) {
    if (!covered.has(s.id)) {
      issues.push({
        level: doc.basic.type === "subject" ? "error" : "warning",
        field: codes.get(s.id) ?? "성취기준",
        message:
          doc.basic.type === "subject"
            ? "이 성취기준의 성취수준이 없습니다. 과목은 모든 성취기준에 대한 성취수준을 작성해야 합니다."
            : "이 성취기준에 대한 평가 계획이 없습니다.",
        fix: "평가 계획에 이 성취기준을 포함해 주세요. (두 성취기준을 묶어 평가 가능)",
      });
    }
  }
  return tag("assessment", issues);
}

/** (과목) 교수·학습 방향 및 방법, 평가 방향 및 방법 */
export function checkTeaching(doc: Pick<DesignDoc, "basic" | "teaching">): Issue[] {
  if (doc.basic.type !== "subject") return [];
  const t = doc.teaching;
  const parts: [string[], string][] = [
    [t.teachingDirection, "교수·학습의 방향"],
    [t.teachingMethods, "교수·학습의 방법"],
    [t.assessDirection, "평가의 방향"],
    [t.assessMethods, "평가의 방법"],
  ];
  return tag(
    "teaching",
    parts
      .filter(([list]) => list.filter((s) => s.trim()).length === 0)
      .map(([, name]) => ({ level: "error" as const, field: name, message: `${name}이 비어 있습니다.`, fix: "항목을 1개 이상 적어 주세요." })),
  );
}

/** 계획서(서식1)·신청서(서식3) 항목 */
export function checkApplication(doc: Pick<DesignDoc, "basic" | "application">): Issue[] {
  const a = doc.application;
  const issues: Issue[] = [];
  if (!a.schoolName.trim()) issues.push({ level: "error", field: "학교명", message: "학교명이 비어 있습니다.", fix: "학교명을 적어 주세요." });
  if (!a.textbookType) issues.push({ level: "error", field: "교재 활용 계획", message: "교재 구분을 고르지 않았습니다.", fix: "교재 구분을 골라 주세요." });
  if (!a.textbookName.trim()) issues.push({ level: "warning", field: "교재/자료명", message: "교재/자료명이 비어 있습니다.", fix: "사용할 교재나 자료 이름을 적어 주세요." });
  if (a.teacherPlans.length === 0) issues.push({ level: "error", field: "지도교사 확보 방안", message: "지도교사 확보 방안을 고르지 않았습니다.", fix: "1안~3안 중 하나 이상 골라 주세요." });
  if (doc.basic.type === "subject" && !a.englishName.trim()) {
    issues.push({ level: "warning", field: "영문 과목명", message: "신청서에 영문 과목명 칸이 있습니다.", fix: "영문 과목명을 적어 주세요." });
  }
  return tag("application", issues);
}

/** 체크리스트: 교사 확인 항목이 남았는지 */
export function checkChecklist(doc: Pick<DesignDoc, "basic" | "checklist">): Issue[] {
  const left = checklistFor(doc.basic.type).filter((i) => !i.auto && !doc.checklist[i.id]);
  if (left.length === 0) return [];
  return [
    {
      level: "warning",
      field: "체크리스트",
      message: `직접 확인할 체크리스트 항목이 ${left.length}개 남았습니다.`,
      fix: "점검 화면의 체크리스트에서 확인한 항목에 표시해 주세요.",
      step: "final",
    },
  ];
}

/** 설계 문서 전체 점검 */
export function validateDesign(doc: DesignDoc): Issue[] {
  return [
    ...tag("basic", checkBasicHours(doc.basic)),
    ...(doc.basic.name.trim() ? [] : tag("basic", [{ level: "error" as const, field: `${DESIGN_TYPES[doc.basic.type]}명`, message: "이름이 비어 있습니다.", fix: "이름을 적어 주세요." }])),
    ...checkContentSystem(doc.areas),
    ...checkCoreIdeas(doc.coreIdeas, doc.areas.length),
    ...checkStandards(doc),
    ...checkIntro(doc),
    ...checkUnitPlan(doc).filter((i) => i.field !== "운영 시수"),
    ...checkAssessments(doc),
    ...checkTeaching(doc),
    ...checkApplication(doc),
    ...checkChecklist(doc),
  ];
}

/** 체크리스트 결과: 프로그램이 판정하는 항목은 점검 결과로, 나머지는 교사 확인 표시로 */
export function checklistResults(doc: DesignDoc): { id: string; area: string; label: string; ok: boolean; auto: boolean }[] {
  const issues = validateDesign(doc);
  const noErrorIn = (...steps: StepKey[]) => !issues.some((i) => i.level === "error" && i.step && steps.includes(i.step));
  const kind = doc.basic.type === "subject" ? "과목" : "활동";
  const auto: Record<string, () => boolean> = {
    name: () => noErrorIn("basic"),
    hours: () => noErrorIn("basic") && !issues.some((i) => i.level === "error" && i.field.includes("차시 합계")),
    intro: () => noErrorIn("intro"),
    textbook: () => !!doc.application.textbookType,
    teacher: () => doc.application.teacherPlans.length > 0,
    standards: () => noErrorIn("content", "coreIdeas", "standards"),
    plan: () => noErrorIn("plan", "assessment"),
  };
  return checklistFor(doc.basic.type).map((item) => ({
    id: item.id,
    area: item.area,
    label: item.label(kind),
    auto: !!item.auto,
    ok: item.auto ? (auto[item.auto]?.() ?? false) : !!doc.checklist[item.id],
  }));
}
