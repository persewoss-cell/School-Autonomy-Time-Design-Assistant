import {
  emptyDesign,
  OPENING_TYPES,
  OPERATION_MODES,
  SUBJECT_GROUPS,
  TEACHER_PLANS,
  type AssessmentRow,
  type DesignDoc,
  type Lesson,
  type Standard,
  type Unit,
} from "@/domain/types";
import { codeMap } from "@/domain/codes";
import { COMMON_RULES, toList } from "./common";

/**
 * 기존 문서 가져오기: 우리 학교(또는 다른 곳)에서 이미 만든 설계 문서(PDF·hwpx)를 앱 설계로 옮긴다.
 * 앱은 AI를 부르지 않으므로, 문서 글자를 넣은 프롬프트를 만들고 → 교사가 AI에 붙여 넣고 → AI의 JSON 답을 읽는다.
 * 원칙: 문서 내용은 고치지 않고 그대로 옮긴다 (사용자 결정, 2026-11-11). 지침에 안 맞는 곳은 설계 화면에서 빨간색으로 보인다.
 * 답이 길어 잘리지 않게 1부(문서 앞부분)·2부(단원 지도계획·평가 계획)로 나눠 받는다.
 */

// 예시 값은 자리 표시만 쓴다. 실제 설계 내용을 넣으면 AI가 문서 대신 예시를 베끼는 일이 생김 (2026-11-11 실제 사례)
const PART1_EXAMPLE = `{
  "part": 1,
  "designCount": 1,
  "type": "(과목 또는 활동)",
  "name": "(문서에 적힌 과목명·활동명)",
  "grade": "(학년 숫자)",
  "semester": "(학기 숫자)",
  "hours": "(운영 시수 숫자)",
  "subjectGroup": "(편성 교과)",
  "openingType": "(개설 형태)",
  "operationMode": "(운영 방식)",
  "schoolYear": "(문서의 운영 학년도, 없으면 빈칸)",
  "topic": "(주제 한 줄)",
  "abbrev": "(성취기준 코드 속 약어)",
  "rationale": "(필요성 또는 성격 문단 전체)",
  "overallGoal": "(총괄 목표 문장)",
  "detailGoals": ["(세부 목표 1)", "(세부 목표 2)", "(세부 목표 3)"],
  "coreIdeas": ["(핵심아이디어)"],
  "areas": [
    { "name": "(영역명)", "knowledge": ["(지식·이해 내용 요소)"], "process": ["(과정·기능 내용 요소)"], "values": ["(가치·태도 내용 요소)"] }
  ],
  "standards": [
    { "code": "(문서의 성취기준 코드)", "area": "(몇 번째 영역)", "text": "(성취기준 문장)", "elements": ["(연결된 내용 요소)"] }
  ],
  "teaching": { "teachingDirection": [], "teachingMethods": [], "assessDirection": [], "assessMethods": [] },
  "application": {
    "englishName": "", "establishment": "", "textbookType": "", "textbookName": "",
    "teacherPlans": [], "etc": "", "necessity": "", "goalSummary": "", "contentSummary": ""
  }
}`;

const PART2_EXAMPLE = `{
  "part": 2,
  "units": [
    {
      "unitName": "(단원명)",
      "lessons": [
        {
          "hours": "(이 줄의 차시 수)",
          "topic": "(학습주제)",
          "goal": "(학습 목표, 없으면 빈칸)",
          "activities": ["(학습 내용 한 줄씩)"],
          "assessment": "(과정중심평가 내용, 없으면 빈칸)",
          "assessStandards": ["(평가하는 성취기준 코드)"],
          "note": "(비고)"
        }
      ]
    }
  ],
  "assessments": [
    {
      "month": "(시기)",
      "standards": ["(성취기준 코드)"],
      "focus": "(수업·평가 방법 및 연계의 주안점)",
      "levels": { "A": "(상 수준)", "B": "(중 수준)", "C": "(하 수준)" },
      "methods": ["(평가 방법)"]
    }
  ]
}`;

const PLACEHOLDER_RULE = "괄호 ( ) 안의 말은 자리 표시입니다. 그대로 베끼지 말고 반드시 **올린 문서의 내용**으로 바꿔 채웁니다. 문서에 없으면 빈칸으로 둡니다.";

/** 1부 프롬프트. text가 비면(스캔 문서) 원본 파일을 AI에 직접 첨부하도록 안내한다. */
export function buildImportPrompt(text: string): string {
  const source = text.trim()
    ? `## 문서 내용 (PDF·한글 파일에서 뽑은 글자)
표는 칸이 ' | '로 나뉘어 있고, 줄바꿈·순서가 조금 섞였을 수 있습니다. 문맥으로 바르게 맞춰 읽으세요.

<<<문서 시작>>>
${text.trim()}
<<<문서 끝>>>`
    : `## 문서 내용
이 메시지에 첨부한 파일(학교자율시간 설계 문서)을 읽으세요.`;
  return `당신은 초등학교 학교자율시간 설계 문서를 정리하는 도우미입니다.
아래 문서는 이미 완성된 학교자율시간 과목 또는 활동 설계 문서입니다. 이 문서의 내용을 프로그램이 읽을 수 있는 JSON으로 옮겨 주세요.

## 꼭 지킬 것
- 문서에 적힌 문장을 **글자 그대로** 옮깁니다. 요약하거나, 고치거나, 더 낫게 바꾸지 않습니다.
- 문서에 없는 내용은 지어내지 말고 빈칸("") 또는 빈 목록([])으로 둡니다.
- 성취기준 코드(예: [4과탐구01-01] 모양)도 문서에 적힌 그대로 씁니다.
- 문서에 설계(과목·활동)가 **여러 개** 들어 있으면, 내용을 옮기지 말고 "designCount"에 설계 개수만 적어 답하세요.
${COMMON_RULES}

## 칸 설명
- type: "과목" 또는 "활동"
- grade(학년)·semester(학기)·hours(운영 시수): 숫자
- subjectGroup(편성 교과): ${SUBJECT_GROUPS.join("·")} 중 하나
- openingType(개설 형태): ${OPENING_TYPES.join("·")} 중 하나 / operationMode(운영 방식): ${OPERATION_MODES.join("·")} 중 하나 (문서에 없으면 "")
- schoolYear: 문서에 적힌 운영 학년도 (없으면 "")
- topic: 이 설계의 주제를 문서의 낱말로 한 줄 (영역명을 이어도 됩니다)
- abbrev: 성취기준 코드 속 과목명 약어 (예: [4과탐구01-01]이면 "탐구")
- rationale: 활동은 '필요성', 과목은 '성격' 문단 전체 / overallGoal: 총괄 목표 / detailGoals: 세부 목표 3개 (번호는 빼고)
- areas: 내용 체계의 영역마다 범주별 내용 요소 (knowledge=지식·이해, process=과정·기능, values=가치·태도)
- standards: 성취기준마다 code, area(몇 번째 영역인지 1부터), text(문장), elements(이 성취기준과 연결된 내용 요소. 문서의 내용 체계 문구 그대로)
- teaching: 과목 문서의 '교수·학습 방향/방법', '평가 방향/방법' (한 줄에 하나, 활동이면 빈 목록)
- application: 계획서·신청서에 있는 영문명, 설립 구분, 교재 유형·이름, 담당 교사 운영 방안, 기타, 개설 필요성·목표·내용 요약 (없으면 빈칸)

${source}

## 답하는 형식 (아주 중요)
답이 길어 잘리지 않도록 **두 번에 나눠** 답합니다. 지금은 **1부만** 아래 모양의 JSON 코드 블록 하나로 답하세요.
설명은 쓰지 말고, 키 이름은 영어 그대로 둡니다. 제가 '2부'를 요청하면 그때 단원 지도계획과 평가 계획을 답합니다.
${PLACEHOLDER_RULE}

\`\`\`json
${PART1_EXAMPLE}
\`\`\``;
}

/** 1부 답을 받은 뒤 같은 AI 대화창에 보낼 2부 요청 */
export const IMPORT_PART2_PROMPT = `이제 같은 문서의 **2부**를 답해 주세요: 단원 지도계획과 평가 계획.

## 꼭 지킬 것
- 문서의 문장을 글자 그대로 옮깁니다. 없는 내용은 빈칸으로 둡니다.
- 단원 지도계획 표의 한 줄(차시)마다 lessons 하나. 차시가 '2~3/29'처럼 묶여 있으면 hours는 묶인 차시 수(2)입니다.
- activities: '학습 내용' 칸의 줄을 하나씩 / assessment: 그 차시의 [과정중심평가] 내용 (없으면 "")
- assessStandards: 그 차시에서 평가하는 성취기준 코드 (없으면 [])
- assessments: 평가 계획 표의 한 줄마다 하나. levels는 성취수준 A(상)·B(중)·C(하) 문장, methods는 평가 방법 낱말

## 답하는 형식
설명 없이 아래 모양의 JSON 코드 블록 하나만 답하세요. 답이 중간에 끊기면 제가 '이어서'라고 요청하겠습니다.
${PLACEHOLDER_RULE}

\`\`\`json
${PART2_EXAMPLE}
\`\`\``;

/** 붙여 넣은 글에서 JSON 덩어리를 모두 꺼낸다 (```json 블록이 여러 개여도) */
export function extractAllJson(text: string): unknown[] {
  const clean = (s: string) => s.replace(/[“”]/g, '"').replace(/,\s*([}\]])/g, "$1");
  const fences = [...text.matchAll(/```(?:json|JSON)?\s*([\s\S]*?)```/g)].map((m) => m[1]);
  const bodies = fences.length ? fences : [text];
  const out: unknown[] = [];
  for (const b of bodies) {
    const start = b.indexOf("{");
    const end = b.lastIndexOf("}");
    if (start === -1 || end <= start) continue;
    try {
      out.push(JSON.parse(clean(b.slice(start, end + 1))));
    } catch {
      /* 아래에서 '깨짐'으로 알림 */
    }
  }
  return out;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
const num = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const m = str(v).match(/\d+/);
  return m ? Number(m[0]) : null;
};
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
/** 코드 비교용: 띄어쓰기·괄호 모양 무시 */
const codeKey = (c: string) => c.replace(/\s/g, "").replace(/^\[?/, "[").replace(/\]?$/, "]");

/** 문서에서 찾지 못해 가져오기 전에 선생님이 고르거나 입력할 기본 정보 칸 */
export type MissingKey = "type" | "name" | "grade" | "semester" | "hours" | "subjectGroup" | "openingType" | "operationMode";
export interface MissingField {
  key: MissingKey;
  /** AI 답에 적힌 값 (없으면 "") */
  raw: string;
}

export type ImportParse =
  | { ok: true; doc: DesignDoc; notes: string[]; missing: MissingField[]; /** 성취기준 id → 문서의 원래 코드 */ originalCodes: Record<string, string> }
  | { ok: false; error: string; multiple?: number };

/**
 * 1부·2부 답을 읽어 설계 문서로 만든다.
 * 문서 내용은 그대로 둔다. 기본 정보 중 문서에서 찾지 못했거나 앱 선택지에 없는 칸은 missing으로 돌려주고,
 * 화면이 팝업으로 선생님에게 고르게 한다 (사용자 결정, 2026-11-11). 그 밖의 바꾼 점은 notes로 알린다.
 */
export function parseImport(
  part1Text: string,
  part2Text: string,
  opts: { schoolYear: string; schoolName: string; /** 문서에서 뽑은 글자 (있으면 AI 답이 이 문서 내용인지 확인) */ sourceText?: string },
): ImportParse {
  const all = [...extractAllJson(part1Text), ...extractAllJson(part2Text)].filter(isObj);
  if (!part1Text.trim()) return { ok: false, error: "1부 답을 붙여 넣어 주세요." };
  if (all.length === 0) return { ok: false, error: "답에서 JSON 코드 블록을 찾지 못했거나 형식이 깨져 있습니다. (답이 중간에 끊겼을 수 있어요)" };

  const count = all.map((o) => num(o.designCount)).find((n) => n !== null) ?? 1;
  if (count > 1) return { ok: false, error: `이 파일에는 설계가 ${count}개 들어 있어요.`, multiple: count };

  // part 번호가 없으면 들어 있는 칸으로 판단
  const p1 = all.find((o) => num(o.part) === 1) ?? all.find((o) => "standards" in o || "areas" in o || "name" in o);
  const p2 = all.find((o) => num(o.part) === 2) ?? all.find((o) => "units" in o);
  if (!p1) return { ok: false, error: "1부(기본 정보·내용 체계·성취기준) JSON이 없습니다." };
  if (!p2) return { ok: false, error: "2부(단원 지도계획·평가 계획) JSON이 없습니다. 2부 요청을 AI에 보내고 그 답을 2부 칸에 붙여 넣어 주세요." };

  const notes: string[] = [];
  const missing: MissingField[] = [];
  const doc = emptyDesign();

  // ① 기본 정보: 앱 선택지에 없는 값은 기본값으로 바꾸고 알림
  const typeRaw = str(p1.type);
  doc.basic.type = /과목|subject/i.test(typeRaw) ? "subject" : "activity";
  if (!/과목|활동|subject|activity/i.test(typeRaw)) missing.push({ key: "type", raw: typeRaw });
  let name = str(p1.name).replace(/^[「『"']|[」』"']$/g, "");
  if (name.length > 40) {
    notes.push(`이름이 40자를 넘어 앞부분만 넣었어요: 「${name}」`);
    name = name.slice(0, 40);
  }
  doc.basic.name = name;
  if (!name) missing.push({ key: "name", raw: "" });
  const grade = num(p1.grade);
  if (grade === 3 || grade === 4 || grade === 5 || grade === 6) doc.basic.grade = grade;
  else missing.push({ key: "grade", raw: str(p1.grade) });
  const semester = num(p1.semester);
  if (semester === 1 || semester === 2) doc.basic.semester = semester;
  else missing.push({ key: "semester", raw: str(p1.semester) });
  const pick = <T extends string>(key: MissingKey, raw: string, list: readonly T[], fallback: T): T => {
    const hit = list.find((x) => x.replace(/\s/g, "") === raw.replace(/\s/g, ""));
    if (hit) return hit;
    missing.push({ key, raw });
    return fallback;
  };
  doc.basic.subjectGroup = pick("subjectGroup", str(p1.subjectGroup), SUBJECT_GROUPS, doc.basic.subjectGroup as (typeof SUBJECT_GROUPS)[number]);
  doc.basic.openingType = pick("openingType", str(p1.openingType), OPENING_TYPES, doc.basic.openingType);
  doc.basic.operationMode = pick("operationMode", str(p1.operationMode), OPERATION_MODES, doc.basic.operationMode);

  doc.application.startYear = opts.schoolYear;
  doc.application.schoolName = opts.schoolName;
  const docYear = str(p1.schoolYear).match(/\d{4}/)?.[0];
  if (docYear && docYear !== opts.schoolYear) notes.push(`문서에는 ${docYear}학년도라고 적혀 있지만, 고르신 ${opts.schoolYear}학년도 설계로 가져왔어요.`);

  // ③ 내용 체계·핵심아이디어
  doc.areas = arr(p1.areas)
    .filter(isObj)
    .map((a) => ({ name: str(a.name), knowledge: toList(a.knowledge), process: toList(a.process), values: toList(a.values) }));
  doc.coreIdeas = toList(p1.coreIdeas);
  doc.input = {
    ...doc.input,
    topic: str(p1.topic) || doc.areas.map((a) => a.name).filter(Boolean).join(" · "),
    areaCount: doc.areas.length ? Math.min(5, doc.areas.length) : null,
    areaNames: doc.areas.map((a) => a.name).filter(Boolean).slice(0, 5),
  };

  // ⑤ 성취기준: 코드는 앱이 위치로 계산하므로, 원본 코드는 id 연결에만 쓴다
  const idByCode = new Map<string, string>();
  const originalCode = new Map<string, string>();
  doc.standards = arr(p1.standards)
    .filter(isObj)
    .map((s, i): Standard => {
      const id = `s${i + 1}`;
      const code = str(s.code);
      if (code) {
        idByCode.set(codeKey(code), id);
        originalCode.set(id, code);
      }
      const area = num(s.area) ?? Number(code.match(/(\d{2})-\d{2}\]?$/)?.[1] ?? 1);
      const elements = toList(s.elements);
      return { id, areaIndex: Math.max(0, area - 1), text: str(s.text), elements, textFor: elements };
    });
  // 같은 영역끼리 순서대로 모아 둔다 (코드 순번은 영역 안 순서로 계산됨)
  doc.standards.sort((a, b) => a.areaIndex - b.areaIndex);
  doc.abbrev = str(p1.abbrev) || guessAbbrev([...originalCode.values()][0] ?? "", doc.basic.subjectGroup);

  const originalCodes = Object.fromEntries(originalCode);
  const codeNote = codeDiffNote(doc, originalCodes);
  if (codeNote) notes.push(codeNote);

  // ⑥ 필요성(성격)·목표
  const goals = toList(p1.detailGoals).map((g) => g.replace(/^\(?\d\)\s*/, ""));
  doc.intro = { rationale: str(p1.rationale), overallGoal: str(p1.overallGoal), detailGoals: [goals[0] ?? "", goals[1] ?? "", goals.slice(2).join(" ")] };

  // (과목) 교수·학습 및 평가
  const t = isObj(p1.teaching) ? p1.teaching : {};
  doc.teaching = {
    teachingDirection: toList(t.teachingDirection),
    teachingMethods: toList(t.teachingMethods),
    assessDirection: toList(t.assessDirection),
    assessMethods: toList(t.assessMethods),
  };

  // 계획서·신청서
  const ap = isObj(p1.application) ? p1.application : {};
  const plans = toList(ap.teacherPlans)
    .map((p) => TEACHER_PLANS.find((x) => p.includes(x.slice(0, 4)) || x.includes(p)) ?? null)
    .filter((x): x is (typeof TEACHER_PLANS)[number] => !!x);
  doc.application = {
    ...doc.application,
    englishName: str(ap.englishName),
    establishment: str(ap.establishment) || doc.application.establishment,
    textbookType: str(ap.textbookType),
    textbookName: str(ap.textbookName),
    teacherPlans: plans.length ? [...new Set(plans)] : doc.application.teacherPlans,
    etc: str(ap.etc),
    necessity: str(ap.necessity),
    goalSummary: str(ap.goalSummary),
    contentSummary: str(ap.contentSummary),
  };

  // ⑦ 단원 지도계획 (고른 안으로 바로 넣음)
  const unknownCodes = new Set<string>();
  const idsOf = (codes: unknown): string[] =>
    toList(codes).flatMap((c) => {
      const id = idByCode.get(codeKey(c));
      if (!id) unknownCodes.add(c);
      return id ? [id] : [];
    });
  const units: Unit[] = arr(p2.units)
    .filter(isObj)
    .map((u, ui) => ({
      unitName: str(u.unitName),
      standardIds: doc.standards.filter((s) => s.areaIndex === ui).map((s) => s.id),
      lessons: arr(u.lessons)
        .filter(isObj)
        .map((l): Lesson => {
          const assessed = idsOf(l.assessStandards);
          return {
            hours: Math.max(1, Math.min(32, num(l.hours) ?? 1)),
            topic: str(l.topic),
            goal: str(l.goal),
            activities: toList(l.activities),
            assessment: str(l.assessment),
            assessFor: assessed[0] ?? "",
            ...(assessed.length > 1 ? { assessWith: assessed.slice(1) } : {}),
            inputActivities: [],
            note: str(l.note),
          };
        }),
    }))
    .filter((u) => u.unitName || u.lessons.length);
  doc.plan = units.length ? { candidates: [], demo: false, notes: [], selected: { title: doc.basic.name || "가져온 계획", concept: "기존 문서에서 가져옴", units } } : doc.plan;

  // 운영 시수: 문서에 적힌 값, 없으면 차시 합계 (앱 범위 1~40)
  const lessonSum = units.reduce((s, u) => s + u.lessons.reduce((a, l) => a + l.hours, 0), 0);
  const hours = num(p1.hours) ?? lessonSum;
  doc.basic.hours = Math.max(1, Math.min(40, hours || 1));
  if (!hours || hours !== doc.basic.hours) missing.push({ key: "hours", raw: hours ? `${hours}시간 (앱 범위 1~40 밖)` : "" });
  else if (!num(p1.hours) && lessonSum) notes.push(`문서에서 운영 시수를 찾지 못해 차시 합계(${lessonSum}시간)로 넣었어요.`);

  // ⑧ 평가 계획
  doc.assessments = arr(p2.assessments)
    .filter(isObj)
    .map((a): AssessmentRow => {
      const lv = isObj(a.levels) ? a.levels : {};
      return {
        month: str(a.month),
        standardIds: idsOf(a.standards),
        focus: str(a.focus),
        levels: { A: str(lv.A), B: str(lv.B), C: str(lv.C) },
        methods: toList(a.methods),
      };
    });
  if (unknownCodes.size) notes.push(`성취기준 목록에 없는 코드가 단원 지도계획·평가 계획에 있어 연결하지 못했어요: ${[...unknownCodes].join(", ")}`);

  if (opts.sourceText?.trim()) {
    const mismatch = checkAgainstSource(doc, opts.sourceText);
    if (mismatch) return { ok: false, error: mismatch };
  } else notes.push("원본 파일을 AI에 첨부한 방식이라, 답이 문서 내용과 같은지 앱이 확인하지 못했어요. 단계마다 꼭 확인해 주세요.");
  return { ok: true, doc, notes, missing, originalCodes };
}

export const CODE_NOTE_START = "성취기준 코드 ";

/** 문서의 원래 코드와 앱이 계산한 코드가 다르면 알림 (편성 교과·학년을 바꾸면 다시 계산) */
export function codeDiffNote(doc: DesignDoc, originalCodes: Record<string, string>): string | null {
  const computed = codeMap(doc);
  const differ = doc.standards.filter((s) => originalCodes[s.id] && codeKey(originalCodes[s.id]) !== codeKey(computed.get(s.id)!));
  if (!differ.length) return null;
  const s = differ[0];
  return `${CODE_NOTE_START}${differ.length}개가 앱의 코드 규칙과 달라요 (예: 원본 ${originalCodes[s.id]} → 앱 ${computed.get(s.id)}). 앱은 학년·편성 교과·약어·영역·순서로 코드를 다시 계산해요.`;
}

/** 비교용: 띄어쓰기·줄바꿈·표 칸(|)·문장부호·괄호를 모두 빼고 */
const squash = (t: string) => t.replace(/[\s|·∙⋅‧•\-–—"'“”‘’「」『』<>〈〉《》()[\]{}.,:;!?~/⇒→※*#]/g, "").toLowerCase();

/**
 * AI 답이 정말 올린 문서의 내용인지 확인한다 (AI가 프롬프트의 예시나 다른 설계를 베끼는 일 막기).
 * - 설계 이름이 문서에 있어야 한다.
 * - 성취기준·학습주제·영역명·목표 문장 중 60% 이상이 문서에 있어야 한다.
 *   PDF 표는 한 칸의 글이 여러 줄로 나뉘고 옆 칸 글과 섞이므로, 문장 앞 20자가 그대로 있거나
 *   문장의 낱말(어절) 80% 이상이 문서에 있으면 '있다'로 본다.
 * 다르면 오류 문장, 같으면 null.
 */
export function checkAgainstSource(doc: DesignDoc, sourceText: string): string | null {
  const src = squash(sourceText);
  const name = squash(doc.basic.name);
  if (name && !src.includes(name)) {
    return `AI 답의 설계 이름 「${doc.basic.name}」이(가) 올린 문서에 없어요. AI가 문서 대신 다른 내용(예시 등)을 쓴 것 같아요. 아래 수정 요청을 보내 다시 받아 주세요.`;
  }
  const samples = [
    ...doc.standards.map((s) => s.text),
    ...doc.areas.map((a) => a.name),
    ...(doc.plan.selected?.units.flatMap((u) => u.lessons.map((l) => l.topic)) ?? []),
    doc.intro.overallGoal,
    ...doc.intro.rationale.split("\n"),
  ].filter((t) => squash(t).length >= 4);
  if (samples.length < 3) return null;
  const inSource = (t: string) => {
    if (src.includes(squash(t).slice(0, 20))) return true;
    const words = t.split(/\s+/).map(squash).filter((w) => w.length >= 2);
    return words.length > 0 && words.filter((w) => src.includes(w)).length / words.length >= 0.8;
  };
  const found = samples.filter(inSource).length;
  if (found / samples.length < 0.6) {
    return `AI 답의 문장 ${samples.length}개 중 올린 문서에서 찾을 수 있는 것이 ${found}개뿐이에요. 다른 문서(예시 등)의 내용이 섞였거나 AI가 문장을 바꿔 쓴 것 같아요. 아래 수정 요청을 보내 문서 글자 그대로 다시 받아 주세요.`;
  }
  return null;
}

/** 코드에서 약어 짐작: [학년][교과 첫 글자?][약어][영역]-[순서] */
export function guessAbbrev(code: string, subjectGroup: string): string {
  const m = code.replace(/\s/g, "").match(/^\[?\d([^\d]+)\d{2}-\d{2}\]?$/);
  if (!m) return "";
  const mid = m[1];
  return mid.length >= 3 && mid.startsWith(subjectGroup.charAt(0)) ? mid.slice(1) : mid;
}

/** 같은 학년도에 같은 이름이 있으면 '이름 (2)', '이름 (3)'… */
export function uniqueName(name: string, taken: string[]): string {
  const key = (s: string) => s.replace(/\s/g, "");
  const set = new Set(taken.map(key));
  if (!set.has(key(name))) return name;
  for (let n = 2; ; n++) {
    const suffix = ` (${n})`;
    const next = `${name.slice(0, 40 - suffix.length)}${suffix}`;
    if (!set.has(key(next))) return next;
  }
}
