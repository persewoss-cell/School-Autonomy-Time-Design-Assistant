import type { DesignDoc } from "@/domain/types";
import {
  BLOCK_KEYS,
  BLOCK_TYPES,
  BODY_CM,
  lessonSlots,
  NO_SHEET,
  normalizeBlock,
  sheetHeightCm,
  type BlockType,
  type LessonSlot,
  type Worksheet,
  type WorksheetBlock,
} from "@/domain/worksheet";
import { COMMON_RULES, extractJson, gradeGuide, toList, type AiParse } from "./common";
import { extractJsonBlocks, stripJsonComments } from "./importDoc";
import type { StepPrompt } from "./steps";

/**
 * 차시별 활동지 프롬프트: 단원 하나씩 (답이 길어 잘리지 않게).
 * AI는 학습문제·안내·물음과 칸 구성만 정하고, 칸 모양은 아래 블록 종류 안에서만 고른다.
 */

const EXAMPLE = `{
  "sheets": [
    {
      "lesson": 1,
      "problem": "책 표지를 살펴보고 내용을 예상하여 봅시다.",
      "lead": "자신이 고른 책의 표지를 살펴보고 어떤 이야기일지 예상해 봅시다.",
      "blocks": [
        { "type": "labels", "title": "책의 표지에 어떤 내용이 있는지 살펴보세요.", "rows": ["제목", "글쓴이", "그린이", "출판사"] },
        { "type": "lines", "title": "책 앞표지의 배경에는 어떤 장면이 그려져 있나요?", "count": 2 },
        { "type": "box", "title": "책 표지를 따라 그려 봅시다.", "size": "medium" }
      ]
    }
  ]
}`;

const BLOCK_GUIDE: Record<BlockType, string> = {
  lines: `"lines": 글을 쓰는 줄. count=줄 수(2~8)`,
  labels: `"labels": 왼쪽에 항목 이름, 오른쪽이 빈칸인 표. rows=항목 이름들 (예: 제목·글쓴이·그린이 / 주제·캐릭터·장소·시간)`,
  columns: `"columns": 열 제목이 있는 빈 표. headers=열 제목 2~4개 (예: 인상적인 표현·이유 / 물음·답), count=빈 행 수(2~6)`,
  grid: `"grid": 원고지 (따라 쓰기·바르게 쓰기). count=줄 수(4~10)`,
  box: `"box": 그림을 그리거나 자유롭게 쓰는 큰 상자. size="small"|"medium"|"large"`,
  numbered: `"numbered": 1. 2. 3. 번호가 붙은 상자 (질문 만들기·생각 여러 개). count=상자 수(3~5)`,
  list: `"list": 학생이 읽는 안내 목록 (규칙·단계·방법). items=한 줄씩. 빈칸 없음`,
  storyboard: `"storyboard": 칸을 나눈 그림판 (스토리보드·장면 나누기·만화). count=4|6|9`,
  selfcheck: `"selfcheck": 스스로 평가 표 (1~5점). rows=평가 문장들 (예: 친구의 이야기를 잘 들었다.)`,
  example: `"example": 예시 글 상자 (본보기 글·예문). text=예시 글`,
};

function lessonBlock(doc: DesignDoc, slots: LessonSlot[]): string {
  const forms = doc.worksheets?.settings.forms ?? {};
  return slots
    .map((s) => {
      const f = forms[String(s.no)] ?? [];
      return `### ${s.no}차시 (${s.no}/${doc.basic.hours})${s.parts > 1 ? ` — 묶음 ${s.parts}차시 중 ${s.part}번째` : ""}
- 학습주제: ${s.topic}
- 학습 목표: ${s.goal || "(없음)"}
- 학습 내용: ${s.activities.join(" / ") || "(없음)"}
${s.assessment ? `- 과정중심평가: ${s.assessment}\n` : ""}- 원하는 활동 형태: ${f.length ? f.join(", ") : "(알아서)"}`;
    })
    .join("\n\n");
}

/** 이 단원에서 활동지를 만들 차시 ('활동지 없음'을 고른 차시는 뺌) */
export function unitSlots(doc: DesignDoc, unitIndex: number): LessonSlot[] {
  const forms = doc.worksheets?.settings.forms ?? {};
  return lessonSlots(doc).filter((s) => s.unitIndex === unitIndex && !(forms[String(s.no)] ?? []).includes(NO_SHEET));
}

export function buildWorksheetPrompt(doc: DesignDoc, unitIndex: number): string {
  const slots = unitSlots(doc, unitIndex);
  const st = doc.worksheets?.settings;
  const kind = doc.basic.type === "subject" ? "과목" : "활동";
  const unit = doc.plan.selected?.units[unitIndex];
  return `당신은 초등학교 수업 활동지를 만드는 교사입니다. 학교자율시간 ${kind} 「${doc.basic.name}」(${doc.basic.grade}학년)의 **${unitIndex + 1}단원 「${unit?.unitName ?? ""}」** 차시별 활동지를 구성해 주세요.

## 활동지 모양 (프로그램이 그림)
- 차시마다 A4 한 장. 위쪽 머리칸(${kind}명·단원·차시·학습문제)과 '반·번호·이름' 칸은 프로그램이 넣습니다.
- 당신은 학습문제(problem), ※ 안내 문장(lead), 번호 붙은 활동 칸(blocks)만 정합니다.
- 칸은 아래 종류만 씁니다. 각 칸의 title은 학생에게 하는 물음·지시 한 문장입니다 (번호는 프로그램이 붙임).
${BLOCK_KEYS.map((k) => `  - ${BLOCK_GUIDE[k]}`).join("\n")}

## 만드는 원칙
- 차시의 학습주제·학습 내용에 맞는 활동만 넣습니다. 차시마다 내용에 따라 칸 구성을 다르게 합니다 (글쓰기 차시는 줄·원고지, 그리기·만들기 차시는 상자, 정리 차시는 표, 마지막 정리 차시는 자기평가 등).
- 한 장에 칸은 2~4개. **A4 한 장(본문 약 ${BODY_CM}cm)을 넘지 않게** 줄 수·상자 크기를 정합니다. (큰 상자 13cm, 보통 8cm, 줄 하나 0.9cm)
- problem은 '~해 봅시다.'로 끝나는 한 문장, lead는 학생의 흥미를 끄는 한 문장(선택, 없으면 "").
- 사용 자료가 있으면 물음에 자료 이름을 구체적으로 넣습니다 (예: 「고래는 왜 돌아왔을까?」).
- 학생 개인정보를 적게 하는 칸(주소·전화번호 등)은 만들지 않습니다.
${COMMON_RULES}

## 학년 수준
${gradeGuide(doc.basic.grade)}

## 선생님이 알려 준 것
- 사용 자료: ${st?.material.trim() || "(없음)"}
- 학생 수준·특성: ${st?.learners.trim() || "(없음)"}
- 활동 방식: ${st?.grouping || "(알아서: 차시 내용에 맞게 개인·짝·모둠)"}

## 활동지를 만들 차시 (${slots.length}장)
${lessonBlock(doc, slots)}

## 답하는 형식 (아주 중요)
설명 없이 아래 모양의 JSON 코드 블록 하나만 답하세요. 키 이름은 영어 그대로, 값만 한국어로 채웁니다.
"lesson"은 위 차시 번호(숫자)이고, 위의 ${slots.length}개 차시를 모두 빠짐없이 답합니다.

\`\`\`json
${EXAMPLE}
\`\`\``;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
const num = (v: unknown) => {
  const m = (typeof v === "number" ? String(v) : str(v)).match(/\d+/);
  return m ? Number(m[0]) : undefined;
};
const squash = (t: string) => t.toLowerCase().replace(/[\s_\-·]/g, "");
/** AI가 한국어·다른 이름으로 답해도 받아 준다 (앞에서부터 먼저 맞는 것) */
const TYPE_WORDS: [BlockType, string[]][] = [
  ["selfcheck", ["selfcheck", "selfassessment", "checklist", "자기평가", "스스로평가", "평가표", "체크리스트", "점검표"]],
  ["storyboard", ["storyboard", "comic", "스토리보드", "만화", "그림판", "장면", "칸나눈"]],
  ["grid", ["grid", "manuscript", "원고지"]],
  ["example", ["example", "sample", "예시", "예문", "본보기"]],
  ["numbered", ["numbered", "번호"]],
  ["labels", ["labels", "label", "항목", "빈칸표", "항목표"]],
  ["columns", ["columns", "column", "table", "여러열", "표"]],
  ["list", ["list", "steps", "안내", "목록", "순서", "방법"]],
  ["box", ["box", "drawing", "draw", "picture", "image", "그림", "그리기", "상자", "자유"]],
  ["lines", ["lines", "line", "text", "writing", "쓰는줄", "줄", "쓰기", "글쓰기"]],
];
function blockType(v: unknown): BlockType | null {
  const t = squash(str(v));
  if (!t) return null;
  const exact = BLOCK_KEYS.find((k) => k === t || squash(BLOCK_TYPES[k]) === t);
  if (exact) return exact;
  return TYPE_WORDS.find(([, words]) => words.some((w) => t.includes(w)))?.[0] ?? null;
}
function boxSize(v: unknown): WorksheetBlock["size"] {
  const t = squash(str(v));
  if (/^(large|big|l|큰|크게|크기큼|대)$/.test(t) || t.includes("크")) return "large";
  if (/^(small|s|작은|작게|소)$/.test(t) || t.includes("작")) return "small";
  if (t) return "medium";
  return undefined;
}
/** 항목·열 제목: 배열이 아니라 '제목, 글쓴이'처럼 한 줄로 와도 나눈다 */
const cells = (v: unknown) => (typeof v === "string" && !v.includes("\n") ? toList(v.split(/[,，/、]/).join("\n")) : toList(v));
/** 물음 앞에 AI가 붙인 번호(1. ①)는 뗀다 (번호는 프로그램이 붙임) */
const unnumber = (t: string) => t.replace(/^\s*(?:\d+\s*[.)]|[①-⑳]|\(\d+\))\s*/, "").trim();
/** 이름·반·번호 칸은 머리칸에 이미 있다 */
const NAME_ROW = /^(학년|반|번호|번|이름|성명|학번)$/;

/** 붙여 넣은 글에서 활동지 묶음 꺼내기: 코드 블록 여러 개·주석·'이어서'로 이어 받은 조각·키 이름이 달라도 */
function rawSheets(text: string): { list: Obj[]; broken: boolean; joined: number } {
  const blocks = extractJsonBlocks(text);
  const found: unknown[] = [...blocks.objects];
  let broken = blocks.broken;
  const joined = blocks.joined;
  // 맨 바깥이 배열인 답은 extractJsonBlocks가 못 읽으므로 따로
  if (found.length === 0) {
    const json = extractJson(text);
    if (json) {
      try {
        found.push(JSON.parse(stripJsonComments(json)));
        broken = false;
      } catch {
        /* 아래에서 실패 처리 */
      }
    }
  }
  const list: Obj[] = [];
  const take = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(take);
    else if (isObj(v)) {
      const inner = Object.entries(v).find(([k, x]) => Array.isArray(x) && /^(sheets|worksheets|활동지|items|lessons)$/i.test(k.trim()))?.[1];
      if (inner) take(inner);
      else if ("blocks" in v || "lesson" in v || "problem" in v) list.push(v);
    }
  };
  found.forEach(take);
  return { list, broken, joined };
}

export function parseWorksheets(text: string, doc: DesignDoc, unitIndex: number): AiParse<Worksheet[]> {
  if (!text.trim()) return { ok: false, error: "붙여 넣은 내용이 없습니다." };
  const { list: raw, broken, joined } = rawSheets(text);
  if (raw.length === 0) {
    return {
      ok: false,
      error: broken ? "JSON 형식이 깨져 있습니다. (답이 중간에 끊겼거나 괄호·따옴표가 빠졌을 수 있습니다)" : /[[{]/.test(text) ? "sheets(활동지 목록)가 비어 있습니다." : "답에서 JSON 코드 블록을 찾지 못했습니다.",
    };
  }

  const slots = unitSlots(doc, unitIndex);
  const notes: string[] = [];
  if (joined) notes.push("끊겨서 이어 받은 답을 이어 붙여 읽었어요.");
  if (broken) notes.push("읽지 못한 조각이 있어요. 답이 중간에 끊겼다면 같은 대화창에 '이어서'를 보내고 이어진 답까지 붙여 넣으세요.");
  // 차시 번호가 모두 이 단원의 차시면 번호로, 아니면(단원 안에서 1부터 다시 센 경우 등) 순서대로 맞춘다
  const given = raw.map((r) => num(r.lesson ?? r.차시 ?? r.no));
  const byNumber = given.every((n) => n !== undefined && slots.some((s) => s.no === n));
  if (!byNumber && given.some((n) => n !== undefined)) notes.push("차시 번호가 이 단원의 차시 번호와 맞지 않아, 답의 순서대로 차시에 맞췄어요. 차시별 내용이 맞는지 확인해 주세요.");
  const dropped = new Set<string>();
  let nameRows = false;
  let dup = 0;
  const sheets: Worksheet[] = [];
  raw.forEach((r, i) => {
    const slot = byNumber ? slots.find((s) => s.no === given[i]) : slots[i];
    if (!slot) return;
    if (sheets.some((s) => s.no === slot.no)) {
      dup++;
      return;
    }
    const blocks: WorksheetBlock[] = (Array.isArray(r.blocks) ? r.blocks : []).filter(isObj).flatMap((b) => {
      const type = blockType(b.type);
      if (!type) {
        if (str(b.type)) dropped.add(str(b.type));
        return [];
      }
      let rows = cells(b.rows);
      if (type === "labels" && rows.some((x) => NAME_ROW.test(x.replace(/\s/g, "")))) {
        nameRows = true;
        rows = rows.filter((x) => !NAME_ROW.test(x.replace(/\s/g, "")));
        if (rows.length === 0) return [];
      }
      return [
        normalizeBlock({
          type,
          title: unnumber(str(b.title)),
          count: num(b.count),
          rows,
          headers: cells(b.headers),
          items: toList(b.items),
          text: str(b.text),
          size: boxSize(b.size),
        }),
      ];
    });
    const problem = str(r.problem).replace(/^(학습\s*문제|학습\s*목표)\s*[:：]\s*/, "");
    sheets.push({ no: slot.no, topic: slot.topic, problem: problem || slot.goal || slot.topic, lead: str(r.lead).replace(/^※\s*/, ""), blocks });
  });
  if (sheets.length === 0) return { ok: false, error: "이 단원의 차시와 맞는 활동지가 없습니다. lesson에 차시 번호를 넣었는지 확인하세요." };
  sheets.sort((a, b) => a.no - b.no);
  const missing = slots.filter((s) => !sheets.some((x) => x.no === s.no)).map((s) => s.no);
  if (missing.length) notes.push(`${missing.join(", ")}차시 활동지가 답에 없어요. 아래 '고치기 요청'으로 다시 받거나 직접 추가하세요.`);
  if (dup) notes.push(`같은 차시가 두 번 나온 것은 처음 것만 넣었어요.`);
  if (dropped.size) notes.push(`앱에 없는 칸 종류(${[...dropped].join(", ")})는 뺐어요.`);
  if (nameRows) notes.push("이름·반·번호 칸은 활동지 머리에 이미 있어서 뺐어요.");
  const long = sheets.filter((s) => sheetHeightCm(s) > BODY_CM).map((s) => s.no);
  if (long.length) notes.push(`${long.join(", ")}차시는 A4 한 장을 넘을 수 있어요. 줄 수나 상자 크기를 줄여 주세요.`);
  return { ok: true, data: sheets, notes };
}

/** AiAssist에 넘길 단원별 프롬프트 */
export function worksheetPrompt(unitIndex: number): StepPrompt<Worksheet[]> {
  return {
    build: (doc) => buildWorksheetPrompt(doc, unitIndex),
    parse: (text, doc) => parseWorksheets(text, doc, unitIndex),
    reminder: () => `- 칸 종류(type)는 ${BLOCK_KEYS.join(", ")} 중에서만 고릅니다.\n- "lesson"에는 차시 번호(숫자)를 넣습니다.`,
    followUp: (sheets, doc) => {
      const missing = unitSlots(doc, unitIndex).filter((s) => !sheets.some((x) => x.no === s.no));
      if (!missing.length) return null;
      return {
        title: `${missing.map((s) => s.no).join(", ")}차시 활동지가 빠졌어요`,
        prompt: `빠진 차시가 있습니다: ${missing.map((s) => `${s.no}차시(${s.topic})`).join(", ")}.
앞의 규칙을 그대로 지켜, 이 단원의 모든 차시를 빠짐없이 다시 답해 주세요. 설명 없이 \`\`\`json 코드 블록 하나만 답합니다.`,
      };
    },
  };
}
