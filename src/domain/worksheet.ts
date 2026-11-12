import type { DesignDoc } from "./types";

/**
 * 차시별 활동지 (선택 단계, 사용자 결정 2026-11-11)
 * 단원 지도계획의 차시마다 A4 한 장. 모양은 광양중동초 '나도 그림책 작가' 활동지를 따른다:
 * 머리칸(로고·설계 이름·단원·차시·학습문제) + 반·번호·이름 칸 + ※ 안내 + 번호 붙은 물음과 칸들.
 * AI는 물음·칸 구성(블록)만 제안하고, 모양(표·줄·상자)은 코드가 정한 틀로만 그린다.
 */

/** 활동지 칸(블록) 종류 */
export const BLOCK_TYPES = {
  lines: "쓰는 줄",
  labels: "항목별 빈칸 표",
  columns: "여러 열 표",
  grid: "원고지",
  box: "그리기·자유 상자",
  numbered: "번호 상자",
  list: "안내 목록",
  storyboard: "칸 나눈 그림판",
  selfcheck: "자기평가 표",
  example: "예시 글 상자",
} as const;
export type BlockType = keyof typeof BLOCK_TYPES;
export const BLOCK_KEYS = Object.keys(BLOCK_TYPES) as BlockType[];

export type BoxSize = "small" | "medium" | "large";
export const BOX_SIZES: Record<BoxSize, string> = { small: "작게", medium: "보통", large: "크게" };

export interface WorksheetBlock {
  type: BlockType;
  /** 번호 뒤에 붙는 물음·안내 (예: "책의 표지에 어떤 내용이 있는지 살펴보세요.") */
  title: string;
  /** lines: 줄 수, columns: 빈 행 수, grid: 원고지 줄 수, numbered: 상자 수, storyboard: 칸 수(4·6·9) */
  count?: number;
  /** labels: 왼쪽 항목 이름 (제목·글쓴이…) / selfcheck: 평가 항목 */
  rows?: string[];
  /** columns: 열 제목 */
  headers?: string[];
  /** list: 안내 줄 */
  items?: string[];
  /** example: 예시 글 */
  text?: string;
  /** box: 크기 */
  size?: BoxSize;
  /** 교사용 예시 답 (학생 활동지에는 나오지 않고 교사용 답안 파일에만) */
  answer?: string;
  /** 남는 공간 채우기로 늘어난 높이(cm, box·numbered). 저장하지 않고 내려받기·미리보기 때만 계산 */
  stretchCm?: number;
}

export interface Worksheet {
  /** 차시 번호 (1부터) */
  no: number;
  /** 만들 때의 학습주제 (단원 지도계획이 바뀌었는지 알기 위해) */
  topic: string;
  /** 학습문제 (머리칸) */
  problem: string;
  /** ※ 안내 문장 (굵게) */
  lead: string;
  blocks: WorksheetBlock[];
}

export const WORKSHEET_COLORS = {
  black: { label: "검정", line: "000000", fill: "F2F2F2" },
  orange: { label: "주황", line: "F4B183", fill: "FBE5D6" },
  blue: { label: "파랑", line: "8EAADB", fill: "D9E2F3" },
  green: { label: "초록", line: "A9D18E", fill: "E2F0D9" },
} as const;
export type WorksheetColor = keyof typeof WORKSHEET_COLORS;

export const ACTIVITY_FORMS = ["글쓰기", "그리기", "표·그래픽 정리", "토의·토론", "조사·관찰", "만들기", "역할극·발표", "놀이·게임", "자기평가·성찰"] as const;
/** 이 차시는 활동지를 만들지 않음 */
export const NO_SHEET = "활동지 없음";
export const GROUPINGS = ["", "개인", "짝", "모둠", "섞어서"] as const;

export interface WorksheetSettings {
  /** 사용 자료 (책·영상·교재 등) */
  material: string;
  /** 학생 수준·특성 (개인정보 없이) */
  learners: string;
  /** 개인·짝·모둠 ("" = 알아서) */
  grouping: string;
  color: WorksheetColor;
  /** 학교 로고 (작게 줄인 그림, data URL). 없으면 로고 칸 없이 */
  logo: string;
  /** 차시 번호별 활동 형태 (여러 개, 비면 알아서) */
  forms: Record<string, string[]>;
  /** 남는 공간을 마지막 쓰기·그리기 칸을 늘려 채우기 (없으면 켜짐, 사용자 결정 2026-11-12) */
  fillPage?: boolean;
}

export interface Worksheets {
  settings: WorksheetSettings;
  sheets: Worksheet[];
}

export const emptyWorksheets = (): Worksheets => ({
  settings: { material: "", learners: "", grouping: "", color: "black", logo: "", forms: {} },
  sheets: [],
});

/** 활동지 한 장이 되는 차시 (묶인 차시도 차시마다 한 장) */
export interface LessonSlot {
  no: number;
  unitIndex: number;
  lessonIndex: number;
  unitName: string;
  topic: string;
  goal: string;
  activities: string[];
  assessment: string;
  /** 묶인 차시 안에서 몇 번째인지 (1부터)와 묶인 차시 수 */
  part: number;
  parts: number;
}

export function lessonSlots(doc: Pick<DesignDoc, "plan">): LessonSlot[] {
  const plan = doc.plan.selected;
  if (!plan) return [];
  const out: LessonSlot[] = [];
  let no = 1;
  plan.units.forEach((u, unitIndex) =>
    u.lessons.forEach((l, lessonIndex) => {
      for (let part = 1; part <= l.hours; part++) {
        out.push({ no: no++, unitIndex, lessonIndex, unitName: u.unitName, topic: l.topic, goal: l.goal, activities: l.activities, assessment: l.assessment, part, parts: l.hours });
      }
    }),
  );
  return out;
}

/** 머리칸의 차시 표시 (예: 3/29) — 분모는 운영 시수 */
export const slotLabel = (no: number, doc: Pick<DesignDoc, "basic">) => `${no}/${doc.basic.hours}`;

/** 단원 이름 앞에 번호가 없으면 '1. ' 붙이기 (머리칸 '단원' 칸) */
export const unitTitle = (unitName: string, unitIndex: number) => (/^\s*\d/.test(unitName) ? unitName.trim() : `${unitIndex + 1}. ${unitName.trim()}`);

/** 'AI 없이 직접 입력하기'용 빈 활동지 */
export function blankSheet(slot: LessonSlot): Worksheet {
  return {
    no: slot.no,
    topic: slot.topic,
    problem: slot.goal || slot.topic,
    lead: "",
    blocks: [{ type: "lines", title: "", count: 4 }],
  };
}

/** 칸 수·줄 수를 앱 범위 안으로 (교사용 예시 답은 그대로 둠) */
export function normalizeBlock(b: WorksheetBlock): WorksheetBlock {
  const base = normalizeShape(b);
  const answer = b.answer?.trim();
  return answer && b.type !== "list" && b.type !== "example" ? { ...base, answer } : base;
}

function normalizeShape(b: WorksheetBlock): WorksheetBlock {
  const clamp = (n: number | undefined, lo: number, hi: number, d: number) => Math.max(lo, Math.min(hi, Math.round(n ?? d)));
  const lines = (a?: string[]) => (a ?? []).map((s) => s.trim()).filter(Boolean);
  switch (b.type) {
    case "lines":
      return { type: b.type, title: b.title, count: clamp(b.count, 1, 20, 4) };
    case "labels":
      return { type: b.type, title: b.title, rows: lines(b.rows).slice(0, 10).length ? lines(b.rows).slice(0, 10) : ["", "", ""] };
    case "columns": {
      const headers = lines(b.headers).slice(0, 5);
      return { type: b.type, title: b.title, headers: headers.length >= 2 ? headers : [...headers, "", ""].slice(0, 2), count: clamp(b.count, 1, 10, 3) };
    }
    case "grid":
      return { type: b.type, title: b.title, count: clamp(b.count, 1, 15, 6) };
    case "box":
      return { type: b.type, title: b.title, size: b.size && b.size in BOX_SIZES ? b.size : "medium" };
    case "numbered":
      return { type: b.type, title: b.title, count: clamp(b.count, 1, 8, 3) };
    case "list":
      return { type: b.type, title: b.title, items: lines(b.items).slice(0, 12) };
    case "storyboard": {
      const n = clamp(b.count, 2, 12, 6);
      return { type: b.type, title: b.title, count: n <= 4 ? 4 : n <= 6 ? 6 : 9 };
    }
    case "selfcheck":
      return { type: b.type, title: b.title, rows: lines(b.rows).slice(0, 10) };
    case "example":
      return { type: b.type, title: b.title, text: (b.text ?? "").trim() };
  }
}

/**
 * 블록 높이 (cm, 대략). A4 세로에서 머리칸·여백을 빼면 본문에 약 21cm.
 * docx와 미리보기가 같은 수치를 쓴다.
 */
export const BOX_HEIGHT_CM: Record<BoxSize, number> = { small: 4, medium: 8, large: 13 };
export const ROW_CM = { line: 0.9, label: 0.9, column: 1.6, grid: 0.82, numbered: 2.6, storyboard: 4.2, selfcheck: 1.1 };
export const BODY_CM = 21;
const TITLE_CM = 1.0;

export function blockHeightCm(b: WorksheetBlock): number {
  const t = b.title.trim() ? TITLE_CM : 0.3;
  switch (b.type) {
    case "lines":
      return t + (b.count ?? 4) * ROW_CM.line;
    case "labels":
      return t + (b.rows?.length ?? 3) * ROW_CM.label;
    case "columns":
      return t + ROW_CM.label + (b.count ?? 3) * ROW_CM.column;
    case "grid":
      return t + (b.count ?? 6) * ROW_CM.grid;
    case "box":
      return t + BOX_HEIGHT_CM[b.size ?? "medium"] + (b.stretchCm ?? 0);
    case "numbered":
      return t + (b.count ?? 3) * ROW_CM.numbered + (b.stretchCm ?? 0);
    case "list":
      return t + (b.items?.length ?? 0) * 0.65;
    case "storyboard":
      return t + Math.ceil((b.count ?? 6) / 3) * ROW_CM.storyboard;
    case "selfcheck":
      return t + ROW_CM.label + (b.rows?.length ?? 0) * ROW_CM.selfcheck;
    case "example":
      return t + Math.max(2, Math.ceil((b.text?.length ?? 0) / 40) * 0.8 + 0.6);
  }
}

export function sheetHeightCm(s: Worksheet): number {
  return (s.lead.trim() ? 1.0 : 0) + s.blocks.reduce((sum, b) => sum + blockHeightCm(b) + 0.5, 0);
}

/** 교사용 답안에서 예시 답 한 줄의 높이 (대략) */
export const answerHeightCm = (b: WorksheetBlock) => (b.answer?.trim() ? Math.ceil(b.answer.trim().length / 45) * 0.6 + 0.3 : 0);

/** 남는 공간 채우기로 늘릴 수 있는 칸 (쓰기·그리기 칸) */
const STRETCHY: BlockType[] = ["lines", "box", "columns", "grid", "numbered"];

/**
 * A4에 남는 공간을 마지막 쓰기·그리기 칸을 늘려 채운 활동지 (내려받기·미리보기용, 저장하지 않음).
 * 줄·원고지·표는 줄을 더하고, 상자·번호 상자는 높이를 늘린다. 이미 꽉 찼거나 늘릴 칸이 없으면 그대로.
 */
export function fillSheet(s: Worksheet, margin = 0.4): Worksheet {
  const i = s.blocks.map((b) => STRETCHY.includes(b.type)).lastIndexOf(true);
  const space = BODY_CM - margin - sheetHeightCm(s);
  if (i === -1 || space < 0.8) return s;
  const b = { ...s.blocks[i] };
  switch (b.type) {
    case "lines":
      b.count = (b.count ?? 4) + Math.floor(space / ROW_CM.line);
      break;
    case "grid":
      b.count = (b.count ?? 6) + Math.floor(space / ROW_CM.grid);
      break;
    case "columns":
      b.count = (b.count ?? 3) + Math.floor(space / ROW_CM.column);
      break;
    default:
      b.stretchCm = (b.stretchCm ?? 0) + space;
  }
  return { ...s, blocks: s.blocks.map((x, k) => (k === i ? b : x)) };
}

/** 활동지 점검 (코드가 검사). 활동지는 선택 단계라 설계 문서 오류에는 넣지 않는다. */
export function worksheetIssues(doc: Pick<DesignDoc, "plan" | "basic" | "worksheets">, sheet: Worksheet): string[] {
  const out: string[] = [];
  const slot = lessonSlots(doc).find((s) => s.no === sheet.no);
  if (!slot) out.push("단원 지도계획에 이 차시가 없어요. (차시 수가 바뀌었어요) 지우거나 다시 만들어 주세요.");
  else if (slot.topic !== sheet.topic) out.push(`단원 지도계획의 학습주제가 바뀌었어요 (지금: ${slot.topic}). 내용이 맞는지 확인하거나 다시 만들어 주세요.`);
  if ((doc.worksheets?.settings.forms[String(sheet.no)] ?? []).includes(NO_SHEET)) out.push(`이 차시는 '${NO_SHEET}'으로 골랐는데 활동지가 남아 있어요. 필요 없으면 '활동지 삭제'를 눌러 주세요.`);
  if (!sheet.problem.trim()) out.push("학습문제가 비어 있어요.");
  if (sheet.blocks.length === 0) out.push("활동 칸이 하나도 없어요.");
  if (sheetHeightCm(sheet) > BODY_CM) out.push("내용이 많아 A4 한 장을 넘을 수 있어요. 줄 수·상자 크기를 줄여 주세요.");
  return out;
}
