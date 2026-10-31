import { z } from "zod";
import { CATEGORIES, newId, planSchema, standardNeedsRewrite, type Area, type AssessmentRow, type DesignDoc, type Intro, type Plan, type Standard, type Teaching } from "@/domain/types";
import { categoryOf, codeMap, hasSameCategory } from "@/domain/codes";
import { categorySplit, elementCount, splitProblem, standardCountsFor } from "@/domain/standardCounts";
import { areaStandardIds } from "@/domain/codes";
import { planCoverage } from "@/validation/design";
import { unitHoursFor } from "@/domain/unitHours";
import { COMMON_RULES, contextBlock, formatBlock, parseAiJson, toList, type AiParse } from "./common";

const CIRCLED = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"];

/**
 * 설계 단계별 프롬프트와 답 읽기. 순서는 2027 연수 PPT의 문서 작성 순서를 따른다.
 * [전단계] → 내용 체계 → 핵심아이디어 → 성취기준 → 필요성·목표 → 단원 지도계획 → 평가 계획
 *
 * 원칙: AI가 낸 성취기준·내용 요소 중 교사가 확정한 목록에 없는 것은 코드가 걸러 내고 알린다.
 */

export interface StepPrompt<T> {
  build: (doc: DesignDoc) => string;
  parse: (text: string, doc: DesignDoc) => AiParse<T>;
  /** 읽기 실패 시 수정 요청에 덧붙일 말 */
  reminder: (doc: DesignDoc) => string;
  /** 읽었지만 고쳐야 할 점이 있으면 같은 AI에게 보낼 고치기 요청 (없으면 null) */
  followUp?: (data: T, doc: DesignDoc) => { title: string; prompt: string } | null;
}

const kindOf = (doc: DesignDoc) => (doc.basic.type === "subject" ? "과목" : "활동");
const list = z.unknown().transform(toList);

function areasBlock(areas: Area[]): string {
  return areas
    .map(
      (a, i) => `(${i + 1}) 영역: ${a.name}
  - 지식·이해: ${a.knowledge.join(" / ") || "(없음)"}
  - 과정·기능: ${a.process.join(" / ") || "(없음)"}
  - 가치·태도: ${a.values.join(" / ") || "(없음)"}`,
    )
    .join("\n");
}

function standardsBlock(doc: DesignDoc): string {
  const codes = codeMap(doc);
  return doc.standards.map((s) => `${codes.get(s.id)} ${s.text} (${s.areaIndex + 1}영역)`).join("\n");
}

// ───────────────────────── ③ 내용 체계 ─────────────────────────
export const contentSystemPrompt: StepPrompt<Area[]> = {
  build: (doc) => `${contextBlock(doc)}

## 할 일
위 정보로 학교자율시간 ${kindOf(doc)}의 '내용 체계표'를 만들어 주세요.
내용 체계는 무엇을 가르치고 배울지를 범위와 수준으로 제시한 것입니다.

## 반드시 지킬 규칙
1. ${areaRule(doc)}
   영역 이름은 명사형으로 씁니다. (영역 = 내용과 활동을 범주화한 소주제, 단원명이 될 수 있음)
2. 영역마다 세 범주의 내용 요소를 각각 1~3개 씁니다.
   - 지식·이해(knowledge): 이해해야 할 개념·원리. 반드시 명사형. (X) 평화의 중요성 알기 → (O) 평화의 중요성
   - 과정·기능(process): 사고 및 탐구 과정. 반드시 '~하기'로 끝냄. 예: 탐구하기, 자료수집하기, 비교·분석하기, 해결 방법 모색하기, 표현하기, 발표하기, 제작하기, 성찰하기
   - 가치·태도(values): 기를 수 있는 가치와 태도. 명사형. 주된 종결어: 태도, 흥미, 인식, 자세, 가치관, 감수성, 실천, 배려, 존중, 민감성, 내면화, 호기심, 관용, 효능감, 어울림
3. '꼭 들어가야 할 내용'은 반드시 어느 영역의 내용 요소에 반영합니다.
4. 학습 내용들을 포괄하도록 쓰고, 특정 브랜드나 지역명은 쓰지 않습니다.
5. 위 '학년 수준'에 맞는 낱말과 범위로 씁니다. (${doc.basic.grade}학년 학생이 이해하고 해낼 수 있는 내용)
${COMMON_RULES}

${formatBlock(`{
  "areas": [
    {
      "name": "영역 이름",
      "knowledge": ["명사형 내용 요소"],
      "process": ["~하기"],
      "values": ["~태도"]
    }
  ]
}`)}`,
  parse: (text, doc) => {
    const r = parseAiJson(
      text,
      z.union([
        z.object({ areas: z.array(z.unknown()).min(1) }).transform((v) => v.areas),
        z.array(z.unknown()).min(1),
      ]),
    );
    if (!r.ok) return r;
    const areaSchema = z.object({ name: z.string().trim().min(1), knowledge: list, process: list, values: list });
    const parsed = z.array(areaSchema).safeParse(r.data);
    if (!parsed.success) return { ok: false, error: "영역 이름(name) 또는 내용 요소 칸이 비었거나 형식이 맞지 않습니다." };
    const notes: string[] = [];
    const { count, names } = areaPlan(doc);
    if (count && parsed.data.length !== count) {
      notes.push(`전단계에서 영역을 ${count}개로 정했는데 AI가 ${parsed.data.length}개를 주었습니다. 표에서 고치거나 AI에게 다시 요청하세요.`);
    } else if (!count && parsed.data.length > 3) {
      notes.push(`AI가 영역을 ${parsed.data.length}개 주었습니다. 2~3개로 줄이는 것을 권장합니다.`);
    }
    const norm = (s: string) => s.replace(/\s+/g, "");
    const differ = names.filter((n, i) => norm(parsed.data[i]?.name ?? "") !== norm(n));
    if (differ.length) notes.push(`정해 둔 영역명과 다르게 온 영역이 있습니다: ${differ.join(", ")} — 표의 영역 이름 칸에서 고쳐 주세요.`);
    return { ok: true, data: parsed.data, notes };
  },
  reminder: (doc) => `- ${areaRule(doc)}
- 각 영역에 name, knowledge, process, values가 있어야 합니다.`,
};

/** 전단계에서 정한 영역 수·영역명 (오래된 저장본에는 없을 수 있음) */
function areaPlan(doc: DesignDoc): { count: number | null; names: string[] } {
  const names = (doc.input.areaNames ?? []).map((s) => s.trim()).filter(Boolean);
  const count = doc.input.areaCount ?? null;
  return { count: count ? Math.max(count, names.length) : null, names };
}

/** 영역 수·영역명 규칙 문장: 정해 둔 것은 그대로, 비어 있으면 AI가 정함 */
function areaRule(doc: DesignDoc): string {
  const { count, names } = areaPlan(doc);
  const total = count ?? (names.length >= 2 ? names.length : null);
  const countText = total ? `영역은 정확히 ${total}개로 나눕니다.` : "영역은 주제와 운영 시수에 맞게 2~3개로 나눕니다.";
  if (names.length === 0) return `${countText} 영역 이름은 주제에 맞게 정합니다.`;
  const fixed = names.map((n, i) => `(${i + 1}) ${n}`).join(", ");
  const rest = total && total > names.length ? ` 나머지 ${total - names.length}개 영역의 이름은 주제에 맞게 정합니다.` : !total ? " 더 필요한 영역의 이름은 주제에 맞게 정합니다." : "";
  return `${countText} 다음 영역 이름은 순서대로 글자 그대로 씁니다: ${fixed}.${rest}`;
}

// ───────────────────────── ④ 핵심아이디어 ─────────────────────────
export const coreIdeasPrompt: StepPrompt<string[]> = {
  build: (doc) => `${contextBlock(doc)}

## 확정한 내용 체계
${areasBlock(doc.areas)}

## 할 일
위 내용 체계의 '핵심아이디어'를 영역마다 1개씩, 모두 ${doc.areas.length}개 써 주세요.

## 핵심아이디어 작성 규칙
1. ${kindOf(doc)}의 학습을 통해 일반화할 수 있는 내용을 핵심적으로 진술합니다. (학습 내용의 종합적 사고의 귀결점)
2. 주요 개념과 관련 개념을 연결하고, 학생들이 탐구를 통하여 발견해야 하는 진술문 형태로 씁니다.
3. 광범위하고 추상적이며 지속성과 보편성을 갖게 씁니다. 시간과 문화를 초월할 수 있는 문장일수록 좋습니다.
4. '~해야 한다'와 같은 당위적 표현은 쓰지 않습니다.
5. 낱말 풀이식 진술은 쓰지 않습니다. 예: (X) 법원은 재판을 한다.
6. 각 문장은 '~다.'로 끝냅니다.
   좋은 예: 문화는 예술을 통하여 가치와 신념이 표현된다.
${COMMON_RULES}

${formatBlock(`{
  "coreIdeas": ["1영역의 핵심아이디어", "2영역의 핵심아이디어"]
}`)}`,
  parse: (text) => {
    const r = parseAiJson(text, z.union([z.object({ coreIdeas: list }).transform((v) => v.coreIdeas), list]));
    if (!r.ok) return r;
    if (r.data.length === 0) return { ok: false, error: "핵심아이디어(coreIdeas)가 비어 있습니다." };
    return { ok: true, data: r.data, notes: [] };
  },
  reminder: (doc) => `- coreIdeas에 영역 수만큼(${doc.areas.length}개) 문장을 넣어 주세요.`,
};

// ───────────────────────── ⑤ 성취기준 ─────────────────────────
export const standardsPrompt: StepPrompt<Standard[]> = {
  build: (doc) => {
    const restructure =
      doc.basic.type === "activity"
        ? "활동은 기존 교과 성취기준을 재구조화(내용 요소 변경, 지역·학교 사례로 구체화, 학생 수준에 맞게 변경)할 수 있지만, 기존 성취기준을 그대로 옮겨 쓰면 안 됩니다."
        : "과목은 기존 교과 성취기준을 쓰지 않고 새로운 성취기준을 개발합니다.";
    return `${contextBlock(doc)}

## 확정한 내용 체계
${areasBlock(doc.areas)}

## 핵심아이디어
${doc.coreIdeas.map((s) => `- ${s}`).join("\n")}

## 할 일
위 내용 체계로 성취기준을 써 주세요. 영역마다 아래 개수와 묶을 범주를 **정확히** 지킵니다.
내용 요소는 성취기준마다 **고르게** 나눕니다. 각 성취기준의 내용 요소 수는 아래 괄호 속 숫자와 같아야 합니다. (예: 내용 요소 6개를 성취기준 2개로 → 3개·3개. 4개·2개 ✕)
${standardCountsFor(doc)
  .map((n, i) => {
    const split = categorySplit(doc.areas[i], n);
    const total = elementCount(doc.areas[i]);
    return `- (${i + 1}) ${doc.areas[i].name}: 내용 요소 ${total}개 → 성취기준 ${n}개 — ${
      split
        ? `묶을 범주: ${split.map((cs, j) => `${CIRCLED[j] ?? `${j + 1})`} ${cs.map((c) => CATEGORIES[c]).join(" + ")} (${cs.length}개)`).join("  ")}`
        : `(내용 체계를 고쳐야 합니다: ${splitProblem(doc.areas[i]) ?? "범주별 내용 요소 수를 확인하세요."})`
    }`;
  })
  .join("\n")}

## 성취기준 작성 규칙
1. 성취기준은 학습을 통해 학생이 할 수 있어야 할 결과 혹은 도달점으로 진술합니다.
2. 성취기준 하나는 **서로 다른 범주**의 내용 요소를 묶어 한 문장으로 씁니다. **같은 범주의 내용 요소 2개를 함께 묶지 않습니다.** (예: 지식·이해 + 지식·이해 ✕)
   - 2개를 묶으면 서로 다른 두 범주에서 하나씩 (예: 지식·이해 + 과정·기능)
   - 3개를 묶으면 지식·이해 + 과정·기능 + 가치·태도 세 범주에서 하나씩
   - 위에 적은 '묶을 범주'를 지킵니다.
   예: 코딩 로봇의 기본 요소와 사용법[지식·이해]을 익히고, 창의적인 작품을 만든다.[과정·기능]
3. elements에는 그 성취기준이 다루는 내용 요소를 그 영역의 내용 체계에서 **글자 그대로 복사해서** 넣습니다. 성취기준 하나에 **반드시 2개 또는 3개**입니다. 내용 체계에 없는 내용 요소는 넣지 않습니다.
   **내용 요소 하나는 성취기준 하나에만** 넣습니다. 같은 내용 요소를 두 성취기준에 겹쳐 쓰지 않고, 그 영역의 내용 요소를 **빠짐없이 모두** 나누어 씁니다.
4. area에는 영역 번호(1부터)를 씁니다.
5. 문장은 '~한다.', '~갖는다.', '~기른다.'처럼 끝냅니다. **'~할 수 있다.'로 끝내지 않습니다.** (예: '만들 수 있다.' → '만든다.')
6. 같은 도달점을 반복하지 않습니다.
7. ${restructure}
8. 성취기준 코드 번호는 쓰지 않습니다. (프로그램이 자동으로 붙입니다)
${COMMON_RULES}

${formatBlock(`{
  "standards": [
    {
      "area": 1,
      "text": "~을 이해하고, ~한다.",
      "elements": ["내용 체계에서 복사한 내용 요소", "내용 체계에서 복사한 내용 요소"]
    }
  ]
}`)}`;
  },
  parse: (text, doc) => {
    const item = z.object({
      area: z.coerce.number().int(),
      text: z.string().trim().min(1),
      elements: list,
    });
    const r = parseAiJson(text, z.union([z.object({ standards: z.array(item).min(1) }).transform((v) => v.standards), z.array(item).min(1)]));
    if (!r.ok) return r;
    const notes: string[] = [];
    const data: Standard[] = [];
    const usedElements = new Set<string>();
    const repeated = new Set<string>();
    const short = new Set<string>();
    const over = new Set<string>();
    const sameCat = new Set<string>();
    for (const s of r.data) {
      const areaIndex = s.area - 1;
      if (areaIndex < 0 || areaIndex >= doc.areas.length) {
        notes.push(`영역 번호 ${s.area}은(는) 없는 영역이라 '${s.text.slice(0, 20)}…' 성취기준을 뺐습니다.`);
        continue;
      }
      // 확정한 내용 체계에 없는 내용 요소는 걸러 낸다 (AI가 지어낸 내용 요소 차단)
      const kept = s.elements.filter((e) => categoryOf(doc.areas, e) !== null);
      const dropped = s.elements.filter((e) => categoryOf(doc.areas, e) === null);
      if (dropped.length) notes.push(`내용 체계에 없는 내용 요소를 뺐습니다: ${dropped.join(", ")}`);
      // 내용 요소 하나는 성취기준 하나에만: 앞 성취기준에서 이미 쓴 것은 뺀다
      const normalized = [...new Set(kept.map((e) => findElementText(doc.areas, e) ?? e))].filter((e) => {
        if (!usedElements.has(e)) return true;
        repeated.add(e);
        return false;
      });
      normalized.forEach((e) => usedElements.add(e));
      if (normalized.length < 2) short.add(s.text.slice(0, 20));
      if (normalized.length > 3) over.add(s.text.slice(0, 20));
      if (hasSameCategory(doc.areas, normalized)) sameCat.add(s.text.slice(0, 20));
      data.push({ id: newId(), areaIndex, text: s.text.replace(/^\[[^\]]+\]\s*/, ""), elements: normalized, textFor: normalized });
    }
    if (data.length === 0) return { ok: false, error: "쓸 수 있는 성취기준이 없습니다. 영역 번호(area)를 확인하세요." };
    if (short.size) notes.push(`내용 요소가 2개 미만인 성취기준이 있습니다: ${[...short].map((t) => `'${t}…'`).join(", ")} — 아래에서 내용 요소를 더 고르고 문장을 고쳐 주세요.`);
    if (over.size) notes.push(`내용 요소를 4개 이상 묶은 성취기준이 있습니다: ${[...over].map((t) => `'${t}…'`).join(", ")} — 성취기준마다 2~3개로 고르게 나누도록 아래에서 고치거나 AI에게 다시 요청하세요.`);
    if (sameCat.size) notes.push(`같은 범주의 내용 요소를 함께 묶은 성취기준이 있습니다: ${[...sameCat].map((t) => `'${t}…'`).join(", ")} — 서로 다른 범주끼리 묶이도록 아래에서 내용 요소를 바꾸고 문장을 고쳐 주세요.`);
    if (repeated.size) notes.push(`여러 성취기준에 겹쳐 들어간 내용 요소는 처음 것에만 남겼습니다: ${[...repeated].join(", ")}`);
    standardCountsFor(doc).forEach((want, i) => {
      const got = data.filter((s) => s.areaIndex === i).length;
      if (got !== want) notes.push(`(${i + 1}) ${doc.areas[i].name}: ${want}개로 정했는데 AI가 ${got}개를 주었습니다. 아래에서 추가·삭제하거나 AI에게 다시 요청하세요.`);
    });
    data.sort((a, b) => a.areaIndex - b.areaIndex);
    return { ok: true, data, notes };
  },
  reminder: (doc) =>
    `- standards의 각 항목에 area(영역 번호), text(문장), elements(내용 체계에서 글자 그대로 복사한 내용 요소)가 있어야 합니다.
- 영역별 개수: ${standardCountsFor(doc).map((n, i) => `(${i + 1}) ${n}개`).join(", ")}`,
};

// ───────────── ⑤-2 내용 요소를 바꾼 성취기준의 문장 고치기 ─────────────
export const reviseStandardsPrompt: StepPrompt<{ id: string; text: string }[]> = {
  build: (doc) => {
    const codes = codeMap(doc);
    const targets = doc.standards.filter(standardNeedsRewrite);
    return `${contextBlock(doc)}

## 확정한 내용 체계
${areasBlock(doc.areas)}

## 할 일
아래 성취기준들은 교사가 연결된 내용 요소를 바꾸었습니다. 각 성취기준의 문장을 **'바뀐 내용 요소'에 맞게** 다시 써 주세요.
${targets
  .map(
    (s) => `- ${codes.get(s.id)} (${s.areaIndex + 1}영역)
  지금 문장: ${s.text}
  바뀐 내용 요소: ${s.elements.join(" / ")}`,
  )
  .join("\n")}

## 작성 규칙
1. 바뀐 내용 요소를 모두 담고, 그 밖의 내용 요소는 넣지 않습니다.
2. 바뀐 내용 요소(서로 다른 범주)를 결합한 한 문장으로, 학생의 도달점으로 진술합니다.
3. 문장은 '~한다.', '~갖는다.', '~기른다.'처럼 끝냅니다. **'~할 수 있다.'로 끝내지 않습니다.** (예: '만들 수 있다.' → '만든다.')
4. code에는 위의 성취기준 코드를 그대로 씁니다. text에는 코드 번호를 쓰지 않습니다.
${COMMON_RULES}

${formatBlock(`{
  "standards": [
    { "code": "${targets[0] ? codes.get(targets[0].id) : "[성취기준 코드]"}", "text": "~을 이해하고, ~한다." }
  ]
}`)}`;
  },
  parse: (text, doc) => {
    const item = z.object({ code: z.string(), text: z.string().trim().min(1) });
    const r = parseAiJson(text, z.union([z.object({ standards: z.array(item).min(1) }).transform((v) => v.standards), z.array(item).min(1)]));
    if (!r.ok) return r;
    const byCode = new Map([...codeMap(doc)].map(([id, code]) => [code, id]));
    const unknown: string[] = [];
    const data = r.data.flatMap((s) => {
      const code = (s.code.match(/\[[^\]]+\]/)?.[0] ?? `[${s.code}]`).replace(/\s/g, "");
      const id = byCode.get(code);
      if (!id) unknown.push(s.code);
      return id ? [{ id, text: s.text.replace(/^\[[^\]]+\]\s*/, "") }] : [];
    });
    if (data.length === 0) return { ok: false, error: "성취기준 코드(code)가 목록과 맞지 않습니다." };
    return { ok: true, data, notes: unknown.length ? [`목록에 없는 성취기준 코드는 뺐습니다: ${unknown.join(", ")}`] : [] };
  },
  reminder: () => "- standards의 각 항목에 code(성취기준 코드 그대로)와 text(새 문장)가 있어야 합니다.",
};

/** 띄어쓰기만 다른 내용 요소를 내용 체계의 원래 문구로 바꾼다 */
function findElementText(areas: Area[], element: string): string | null {
  const norm = (s: string) => s.replace(/\s+/g, "");
  for (const a of areas) for (const e of [...a.knowledge, ...a.process, ...a.values]) if (norm(e) === norm(element)) return e;
  return null;
}

// ───────────────────────── ⑥ 필요성(성격) 및 목표 ─────────────────────────
export const introPrompt: StepPrompt<Intro> = {
  build: (doc) => {
    const codes = codeMap(doc);
    const rationaleRule =
      doc.basic.type === "subject"
        ? `rationale에는 '성격'을 씁니다: 과목의 고유 성격 + 과목의 필요성 및 역할 + 기르고자 하는 역량.
   2022 개정 교육과정 총론의 '추구하는 인간상'과 '초등학교 교육목표'와 연계해 3문단 정도로 씁니다. 첫 문장은 「${doc.basic.name}」은(는) ~ 과목이다.로 시작합니다.`
        : `rationale에는 '필요성'을 씁니다: 사회현상 및 시대적 요구 + 학생들이 이 활동을 배워야 하는 까닭 + 기르고자 하는 학생상 혹은 역량.
   이 활동을 배우는 것이 살아가는 데 왜 중요한지 2문단 정도로 씁니다.`;
    return `${contextBlock(doc)}

## 확정한 내용 체계
${areasBlock(doc.areas)}

## 핵심아이디어
${doc.coreIdeas.map((s) => `- ${s}`).join("\n")}

## 성취기준
${doc.standards.map((s) => `${codes.get(s.id)} ${s.text}`).join("\n")}

## 할 일
학교자율시간 ${kindOf(doc)} 문서의 '${doc.basic.type === "subject" ? "성격" : "필요성"}'과 '목표'를 써 주세요.

## 작성 규칙
1. ${rationaleRule}
2. overallGoal(총괄 목표): 학생이 도달해야 할 도달점을 한두 문장으로. 「${doc.basic.name}」은(는) ~하도록 한다. 형태.
3. detailGoals(세부 목표) 3개를 순서대로: ① 지식·이해 ② 과정·기능 ③ 가치·태도. 각각 '~한다.'로 끝냅니다.
4. 위 내용 체계와 성취기준에서 벗어나지 않게 씁니다.
${COMMON_RULES}

${formatBlock(`{
  "rationale": "문단은 줄바꿈(\\n)으로 나눕니다.",
  "overallGoal": "총괄 목표",
  "detailGoals": ["지식·이해 세부 목표", "과정·기능 세부 목표", "가치·태도 세부 목표"]
}`)}`;
  },
  parse: (text) => {
    const r = parseAiJson(
      text,
      z.object({ rationale: z.string().trim().min(1), overallGoal: z.string().trim().min(1), detailGoals: list }),
    );
    if (!r.ok) return r;
    const g = r.data.detailGoals;
    if (g.length < 3) return { ok: false, error: "세부 목표(detailGoals)가 3개가 아닙니다." };
    return {
      ok: true,
      data: { rationale: r.data.rationale, overallGoal: r.data.overallGoal, detailGoals: [g[0], g[1], g[2]] },
      notes: g.length > 3 ? ["세부 목표가 3개보다 많아 앞의 3개만 가져왔습니다."] : [],
    };
  },
  reminder: () => "- rationale, overallGoal, detailGoals(정확히 3개)가 모두 있어야 합니다.",
};

// ───────────────────────── ⑦ 단원 지도계획 3안 ─────────────────────────
export const planPrompt: StepPrompt<Plan[]> = {
  build: (doc) => `${contextBlock(doc)}

## 확정한 내용 체계
${areasBlock(doc.areas)}

## 성취기준 (코드 그대로 사용)
${standardsBlock(doc)}

## 전단계에서 교사가 적은 활동 (번호) — 모두 꼭 넣기
${doc.input.desiredActivities.length ? doc.input.desiredActivities.map((a, i) => `${i + 1}. ${a}`).join("\n") : "(없음)"}

## 단원별 차시 (교사가 정함 — 정확히 지키기)
${unitHoursFor(doc)
  .map((h, i) => `- ${i + 1}단원 (${doc.areas[i].name} 영역): ${h}차시`)
  .join("\n")}

## 단원 지도계획에 반드시 넣을 내용 (교사 추가)
${doc.planRequest?.mustInclude.length ? doc.planRequest.mustInclude.map((m) => `- ${m}`).join("\n") : "(없음)"}

## 기타 참고사항 (교사)
${doc.planRequest?.notes.trim() || "(없음)"}

## 할 일
위 정보로 학교자율시간 ${kindOf(doc)}의 '단원 지도계획' 초안을 서로 다른 3가지 안으로 만들어 주세요.

## 반드시 지킬 규칙
1. 성격이 분명히 다른 3안을 만듭니다. (예: 탐구 중심 / 체험·프로젝트 중심 / 표현·발표 중심)
2. 한 안의 모든 차시(hours)를 더한 값은 반드시 정확히 ${doc.basic.hours}이어야 합니다. 답하기 전에 직접 더해서 확인하세요.
3. 단원은 내용 체계의 영역 순서대로 하나씩 만듭니다. (단원 ${doc.areas.length}개) 단원명은 영역명을 그대로 쓰거나, 영역을 포함하는 의미로 재구성합니다.
   각 단원의 차시 합계는 위 '단원별 차시'와 **정확히** 같아야 합니다.
   단원마다 unitHours에 정한 차시를 적고, 그 단원 lessons의 hours를 **하나씩 더해** unitHours와 같은지 확인한 뒤 답합니다. 다르면 차시를 합치거나 나누어 맞춥니다.
4. n번째 단원은 n번째 영역의 성취기준만 다룹니다. 각 단원의 standards에는 그 영역의 성취기준 코드(영역 번호가 같은 코드)를 **모두, 그대로** 넣습니다.
5. 학습주제(topic)는 짧은 개괄식으로 씁니다.
6. 학습 목표(goal)는 '~해 봅시다.'로 끝나는 한 문장으로 씁니다.
7. 세부 활동(activities)은 2~4개, 학습 순서대로, 각각 '~하기'로 끝나는 구절로 씁니다.
8. 단원 지도계획은 실제로 학생을 가르치는 계획입니다. '꼭 들어가야 할 내용', 위의 **'전단계에서 교사가 적은 활동'**, **'단원 지도계획에 반드시 넣을 내용'**은 모든 안에 빠짐없이 넣습니다. '기타 참고사항'도 반영합니다.
   그 활동을 하는 차시의 fromActivities에 활동 번호를 넣습니다. (예: [2]) 활동이 여러 차시에 걸치면 그 차시마다 넣고, 관계없는 차시는 [].
9. 과정중심평가는 **성취기준 하나에 정확히 1개**입니다. 성취기준이 ${doc.standards.length}개이므로 한 안에 과정중심평가 차시가 정확히 ${doc.standards.length}개입니다.
   - 평가하는 차시의 assessStandard에 그 성취기준 코드 1개를, assessment에 평가 내용을 씁니다.
   - 그 성취기준을 배치한 단원 안에서, **그 성취기준의 내용(내용 요소)을 실제로 배우고 활동하는 차시**에 둡니다.
   - 평가하지 않는 차시는 assessStandard와 assessment를 ""로 둡니다. (다음 단계 평가 계획은 이 과정중심평가로 씁니다)
10. note(비고)에는 마을학교 연계, 코티칭, 원어민 연계 등을 쓰고, 없으면 "".
11. ${doc.basic.grade}학년 수준에 맞는 활동을 제안합니다.
${COMMON_RULES}

${formatBlock(`{
  "plans": [
    {
      "title": "탐구 중심안",
      "concept": "이 안의 특징을 한두 문장으로",
      "units": [
        {
          "unitName": "단원명",
          "unitHours": ${unitHoursFor(doc)[0] ?? doc.basic.hours},
          "standards": ["${standardsBlock(doc).split(" ")[0] || "[성취기준 코드]"}"],
          "lessons": [
            {
              "hours": 2,
              "topic": "학습주제",
              "goal": "~에 대해 알아봅시다.",
              "activities": ["~ 조사하기", "~ 발표하기"],
              "fromActivities": [],
              "assessStandard": "",
              "assessment": "",
              "note": ""
            }
          ]
        }
      ]
    }
  ]
}`, "plans에는 3개의 안이 들어가야 합니다.")}`,
  parse: (text, doc) => {
    const looseLesson = z.object({
      hours: z.coerce.number().int().min(1).max(32),
      topic: z.string().trim().min(1),
      goal: z.string().trim().default(""),
      activities: list.default([]),
      assessment: z.string().nullish().transform((v) => v?.trim().replace(/^\[과정중심평가\]\s*/, "") ?? ""),
      assessStandard: z.string().nullish().transform((v) => v?.trim() ?? ""),
      fromActivities: z
        .union([z.array(z.union([z.number(), z.string()])), z.number(), z.string()])
        .nullish()
        .transform((v) => (v == null ? [] : Array.isArray(v) ? v : [v])),
      note: z.string().nullish().transform((v) => v?.trim() ?? ""),
    });
    const loosePlan = z.object({
      title: z.string().trim().min(1),
      concept: z.string().trim().default(""),
      units: z
        .array(z.object({ unitName: z.string().trim().min(1), standards: list.default([]), lessons: z.array(looseLesson).min(1) }))
        .min(1),
    });
    const r = parseAiJson(text, z.union([z.object({ plans: z.array(loosePlan).min(1) }).transform((v) => v.plans), z.array(loosePlan).min(1)]));
    if (!r.ok) return r;

    const notes: string[] = [];
    let plans = r.data;
    if (plans.length > 3) {
      notes.push(`AI가 ${plans.length}개 안을 주어 앞의 3개만 가져왔습니다.`);
      plans = plans.slice(0, 3);
    } else if (plans.length < 3) {
      notes.push(`AI가 ${plans.length}개 안만 주었습니다. 더 필요하면 AI에게 다시 요청하세요.`);
    }
    // 코드 → id. 목록에 없는 성취기준 코드는 걸러 낸다.
    const byCode = new Map([...codeMap(doc)].map(([id, code]) => [code.replace(/\s/g, ""), id]));
    const unknown = new Set<string>();
    const toId = (c: string) => {
      const code = (c.match(/\[[^\]]+\]/)?.[0] ?? `[${c.replace(/[[\]]/g, "")}]`).replace(/\s/g, "");
      const id = byCode.get(code);
      if (!id) unknown.add(c);
      return id;
    };
    // 활동 번호(1부터) 또는 활동 문구 → 전단계 활동 문구
    const wants = doc.input.desiredActivities;
    const toActivity = (v: number | string) => {
      const n = typeof v === "number" ? v : /^\d+$/.test(v.trim()) ? Number(v.trim()) : NaN;
      if (Number.isInteger(n)) return wants[n - 1];
      const norm = (t: string) => t.replace(/\s+/g, "");
      return wants.find((w) => norm(w) === norm(String(v)));
    };
    const data: Plan[] = plans.map((p) =>
      planSchema.parse({
        title: p.title,
        concept: p.concept || p.title,
        units: p.units.map((u, ui) => ({
          unitName: u.unitName,
          // n번째 단원 = n번째 영역의 성취기준 (AI가 적은 것과 관계없이)
          standardIds: areaStandardIds(doc, ui),
          lessons: u.lessons.map(({ assessStandard, fromActivities, ...l }) => ({
            ...l,
            goal: l.goal || `${l.topic}을(를) 해 봅시다.`,
            activities: l.activities.length ? l.activities : [l.topic],
            assessFor: (assessStandard && toId(assessStandard)) || "",
            inputActivities: [...new Set(fromActivities.map(toActivity).filter((a): a is string => !!a))],
          })),
        })),
      }),
    );
    if (unknown.size) notes.push(`목록에 없는 성취기준 코드를 뺐습니다: ${[...unknown].join(", ")}`);
    const codes = codeMap(doc);
    data.forEach((p, i) => {
      const c = planCoverage(doc, p);
      const missing = c.activities.filter((a) => !a.done).map((a) => a.text);
      if (missing.length) notes.push(`${i + 1}안: 전단계 활동이 빠졌습니다 — ${missing.join(", ")}`);
      const wrong = doc.standards.filter((s) => (c.assessed.get(s.id) ?? 0) !== 1).map((s) => codes.get(s.id));
      if (wrong.length) notes.push(`${i + 1}안: 과정중심평가가 1개가 아닌 성취기준이 있습니다 — ${wrong.join(", ")}`);
      const want = unitHoursFor(doc);
      const got = p.units.map((u) => u.lessons.reduce((sum, l) => sum + l.hours, 0));
      if (got.length !== want.length || got.some((h, k) => h !== want[k])) {
        notes.push(`${i + 1}안: 단원별 차시가 정한 것(${want.join("·")})과 다릅니다 — AI 답: ${got.join("·")}`);
      }
    });
    return { ok: true, data, notes };
  },
  followUp: (plans, doc) => {
    const want = unitHoursFor(doc);
    const lines = plans.flatMap((p, i) => {
      const got = p.units.map((u) => u.lessons.reduce((sum, l) => sum + l.hours, 0));
      const total = got.reduce((a, b) => a + b, 0);
      if (got.length === want.length && got.every((h, k) => h === want[k]) && total === doc.basic.hours) return [];
      const units = got.map((h, k) => `${k + 1}단원 ${h}차시${want[k] === undefined ? "(필요 없는 단원)" : h === want[k] ? " ✓" : ` → ${want[k]}차시로`}`);
      const missing = want.slice(got.length).map((h, k) => `${got.length + k + 1}단원 없음 → ${h}차시로 만들기`);
      return [`- ${i + 1}안(${p.title}): ${[...units, ...missing].join(", ")} / 합계 ${total}차시${total === doc.basic.hours ? "" : ` → ${doc.basic.hours}차시로`}`];
    });
    if (!lines.length) return null;
    return {
      title: "AI가 정한 단원별 차시를 지키지 않았어요. 고르기 전에 차시를 맞춰 달라고 요청하세요.",
      prompt: `방금 답한 단원 지도계획의 차시가 정한 값과 다릅니다.
${lines.join("\n")}

정한 단원별 차시: ${want.map((h, k) => `${k + 1}단원 ${h}차시`).join(", ")} (합계 ${doc.basic.hours}차시)

학습주제·활동·과정중심평가·전단계 활동 연결 등 내용은 최대한 그대로 두고, 차시(hours)만 고쳐 단원별 차시를 정확히 맞춰 주세요.
필요하면 차시를 합치거나 나누세요. 답하기 전에 단원마다 lessons의 hours를 하나씩 더해 unitHours와 같은지 확인하세요.
3안 모두, 앞과 같은 JSON 형식(\`\`\`json 코드 블록 하나)으로 다시 답해 주세요.`,
    };
  },
  reminder: (doc) => `- plans에는 3개의 안이 있어야 하고, 각 안의 hours 합계는 정확히 ${doc.basic.hours}이어야 합니다.
- 단원별 차시 합계: ${unitHoursFor(doc).map((h, i) => `${i + 1}단원 ${h}차시`).join(", ")} (lessons의 hours를 하나씩 더해 확인)
- 각 단원의 standards에는 성취기준 코드를 목록에서 그대로 넣습니다.
- 각 차시에 fromActivities(전단계 활동 번호 목록), assessStandard(평가하는 성취기준 코드 또는 ""), assessment가 있어야 합니다.
- 전단계 활동은 모두 들어가야 하고, 과정중심평가는 성취기준마다 정확히 1개입니다.`,
};

// ───────────────────────── ⑧ 평가 계획 ─────────────────────────
export const ASSESS_METHODS = [
  "관찰평가",
  "자기평가",
  "동료평가",
  "상호평가",
  "서술형평가",
  "수행평가",
  "구술평가",
  "포트폴리오평가",
  "지필평가",
  "체크리스트평가",
  "일화기록평가",
  "프로젝트평가",
  "발표평가",
  "토의·토론평가",
  "산출물평가",
  "실기평가",
];

function assessLessons(doc: DesignDoc): string {
  const plan = doc.plan.selected;
  if (!plan) return "(없음)";
  const codes = codeMap(doc);
  return plan.units
    .flatMap((u) =>
      u.lessons
        .filter((l) => l.assessment.trim())
        .map((l) => `- ${codes.get(l.assessFor) ?? "(성취기준 미정)"} [${u.unitName}] ${l.topic}: [과정중심평가] ${l.assessment}`),
    )
    .join("\n");
}

export const assessmentPrompt: StepPrompt<AssessmentRow[]> = {
  build: (doc) => `${contextBlock(doc)}

## 성취기준 (코드 그대로 사용)
${standardsBlock(doc)}

## 단원 지도계획에 넣은 과정중심평가
${assessLessons(doc)}

## 할 일
위 과정중심평가를 바탕으로 '평가 계획'을 써 주세요.

## 작성 규칙
1. 위 과정중심평가 하나에 평가 계획 한 줄씩, 그 성취기준 1개로 씁니다. (성취기준마다 과정중심평가가 1개씩 있습니다)${doc.basic.type === "subject" ? " 과목은 모든 성취기준에 대한 성취수준을 씁니다." : ""}
2. standards에는 성취기준 코드를 위 목록에서 그대로 넣습니다.
3. month(시기)는 평가 내용에 알맞은 월을 씁니다. (${doc.basic.semester === 1 ? "1학기: 3~7월" : "2학기: 9~12월"}, 예: "9월")
4. focus(수업·평가 방법, 연계의 주안점)는 이렇게 씁니다:
   [수업 방법, 예: 협력중심 학습] ▪ 평가 내용(단원 지도계획의 과정중심평가와 같은 내용) ⇒ (평가 방법) 누가 무엇을 어떻게 확인하는지
5. levels(성취수준)은 A(잘함)·B(보통)·C(노력 필요) 세 단계를 모두 '~할 수 있다.' 형태로 씁니다. 배움이 느린 학생도 참여할 수 있게 C를 씁니다.
6. methods(평가 방법)는 다음 중에서 1~3개 고릅니다: ${ASSESS_METHODS.join(", ")}
${COMMON_RULES}

${formatBlock(`{
  "assessments": [
    {
      "month": "9월",
      "standards": ["${standardsBlock(doc).split(" ")[0] || "[성취기준 코드]"}"],
      "focus": "[협력중심 학습] ▪ 평가 내용 ⇒ (관찰평가, 동료평가) 확인 방법",
      "levels": { "A": "~할 수 있다.", "B": "~할 수 있다.", "C": "~할 수 있다." },
      "methods": ["관찰평가", "동료평가"]
    }
  ]
}`)}`,
  parse: (text, doc) => {
    const item = z.object({
      month: z.coerce.string().default(""),
      standards: list,
      focus: z.string().trim().min(1),
      levels: z.object({ A: z.string().trim().min(1), B: z.string().trim().min(1), C: z.string().trim().min(1) }),
      methods: list,
    });
    const r = parseAiJson(text, z.union([z.object({ assessments: z.array(item).min(1) }).transform((v) => v.assessments), z.array(item).min(1)]));
    if (!r.ok) return r;
    const byCode = new Map([...codeMap(doc)].map(([id, code]) => [code, id]));
    const unknown = new Set<string>();
    const data: AssessmentRow[] = r.data.map((a) => ({
      month: /^\d+$/.test(a.month.trim()) ? `${a.month.trim()}월` : a.month.trim(),
      standardIds: a.standards.flatMap((c) => {
        const code = (c.match(/\[[^\]]+\]/)?.[0] ?? `[${c}]`).replace(/\s/g, "");
        const id = byCode.get(code);
        if (!id) unknown.add(c);
        return id ? [id] : [];
      }),
      focus: a.focus,
      levels: a.levels,
      methods: a.methods,
    }));
    return { ok: true, data, notes: unknown.size ? [`목록에 없는 성취기준 코드를 뺐습니다: ${[...unknown].join(", ")}`] : [] };
  },
  reminder: () => "- assessments의 각 항목에 month, standards, focus, levels(A·B·C), methods가 있어야 합니다.",
};

// ───────────────────────── (과목) 교수·학습 및 평가 방향·방법 ─────────────────────────
export const teachingPrompt: StepPrompt<Teaching> = {
  build: (doc) => `${contextBlock(doc)}

## 확정한 내용 체계
${areasBlock(doc.areas)}

## 성취기준
${standardsBlock(doc)}

## 할 일
학교자율시간 과목 문서의 '교수·학습 방향 및 방법'과 '평가 방향 및 방법'을 써 주세요.

## 작성 규칙
1. teachingDirection(교수·학습의 방향): 과목 목표 달성을 위한 교수·학습의 원칙과 중점 (학생 맞춤형 수업, 학생 주도성, 다양한 학습자 고려 등) 3~5개.
2. teachingMethods(교수·학습의 방법): 방향에 따라 활용할 수 있는 교수·학습 방법과 유의 사항 3~5개.
3. assessDirection(평가의 방향): 과목 목표를 달성하고 학습을 지원하기 위한 평가의 원칙과 중점 (과정 중심 평가, 지식·이해·과정·기능·가치·태도의 다면적 반영, 배움이 느린 학습자 고려 등) 3~4개.
4. assessMethods(평가의 방법): 평가 방법, 평가상의 유의점, 디지털 도구 활용 시 유의점 등 3~4개.
5. 각 항목은 '~한다.'로 끝나는 한 문장 또는 두 문장으로 씁니다.
${COMMON_RULES}

${formatBlock(`{
  "teachingDirection": ["~한다."],
  "teachingMethods": ["~한다."],
  "assessDirection": ["~한다."],
  "assessMethods": ["~한다."]
}`)}`,
  parse: (text) => {
    const r = parseAiJson(text, z.object({ teachingDirection: list, teachingMethods: list, assessDirection: list, assessMethods: list }));
    if (!r.ok) return r;
    return { ok: true, data: r.data, notes: [] };
  },
  reminder: () => "- teachingDirection, teachingMethods, assessDirection, assessMethods 네 목록이 모두 있어야 합니다.",
};

export const CATEGORY_LABEL = CATEGORIES;
