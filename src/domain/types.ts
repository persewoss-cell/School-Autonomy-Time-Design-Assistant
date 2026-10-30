import { z } from "zod";

/** 설계 유형: 과목 / 활동 */
export const DESIGN_TYPES = { subject: "과목", activity: "활동" } as const;
export type DesignType = keyof typeof DESIGN_TYPES;

/** 편성 교과 (초·중등교육법 시행령 제43조의 교과) */
export const SUBJECT_GROUPS = ["국어", "사회", "도덕", "수학", "과학", "실과", "체육", "음악", "미술", "영어"] as const;

export const OPENING_TYPES = [
  "교과 통합형",
  "지역 연계형",
  "학교 특색교육형",
  "기초소양 강화형",
  "학생 주도형",
] as const;

export const OPERATION_MODES = ["지속형", "집중형", "혼합형"] as const;

export const GRADES = [3, 4, 5, 6] as const;
export type Grade = (typeof GRADES)[number];

/** 내용 체계의 세 범주 */
export const CATEGORIES = {
  knowledge: "지식·이해",
  process: "과정·기능",
  values: "가치·태도",
} as const;
export type Category = keyof typeof CATEGORIES;
export const CATEGORY_KEYS = Object.keys(CATEGORIES) as Category[];

/** ① 기본 정보 */
export const basicInfoSchema = z.object({
  type: z.enum(["subject", "activity"]),
  name: z.string().trim().min(1, "과목명/활동명을 입력해 주세요.").max(40),
  grade: z.union([z.literal(3), z.literal(4), z.literal(5), z.literal(6)]),
  semester: z.union([z.literal(1), z.literal(2)]),
  hours: z.number().int().min(1).max(40),
  subjectGroup: z.string().refine((v) => (SUBJECT_GROUPS as readonly string[]).includes(v), "편성 교과를 골라 주세요."),
  openingType: z.enum(OPENING_TYPES),
  operationMode: z.enum(OPERATION_MODES),
});
export type BasicInfo = z.infer<typeof basicInfoSchema>;

/** ② [전단계] 주제와 활동 내용 (학생 개인정보 입력 칸 없음) */
export const topicInputSchema = z.object({
  topic: z.string().trim().min(2, "주제를 입력해 주세요.").max(200),
  requiredContents: z.array(z.string().trim().min(1).max(200)).max(15),
  desiredActivities: z.array(z.string().trim().min(1).max(200)).max(15),
  schoolContext: z.string().trim().max(1000),
  resources: z.string().trim().max(1000),
  /** 내용 체계의 영역 수 (선택, 비우면 AI가 정함) */
  areaCount: z.number().int().min(1).max(5).nullable().default(null),
  /** 정해 둔 영역명 (선택, 비우면 AI가 정함) */
  areaNames: z.array(z.string().trim().min(1).max(60)).max(5).default([]),
});
export type TopicInput = z.infer<typeof topicInputSchema>;

/** ③ 내용 체계의 영역 하나 */
export interface Area {
  name: string;
  knowledge: string[];
  process: string[];
  values: string[];
}

/** ⑤ 성취기준. 코드 번호는 저장하지 않고 위치(영역·순서)로 계산한다. */
export interface Standard {
  id: string;
  areaIndex: number;
  text: string;
  /** 연결한 내용 요소 (내용 체계에 확정된 문구만) */
  elements: string[];
  /** 문장을 쓸 때 연결돼 있던 내용 요소. 지금 elements와 다르면 문장을 고쳐야 함 */
  textFor?: string[];
}

/** 문장을 쓴 뒤 내용 요소가 바뀌었는지 */
export function standardNeedsRewrite(s: Standard): boolean {
  if (!s.textFor || !s.text.trim()) return false;
  const a = [...s.textFor].sort().join("\u0000");
  const b = [...s.elements].sort().join("\u0000");
  return a !== b;
}

/** ⑥ 필요성(활동)·성격(과목) 및 목표 */
export interface Intro {
  /** 활동: 필요성 / 과목: 성격 */
  rationale: string;
  overallGoal: string;
  /** 세부 목표 3개: 지식·이해, 과정·기능, 가치·태도 */
  detailGoals: [string, string, string];
}

/** ⑦ 단원 지도계획 — 차시 번호는 코드가 hours로 계산한다 */
export const lessonSchema = z.object({
  hours: z.number().int().min(1).max(32),
  topic: z.string().min(1),
  goal: z.string().min(1),
  activities: z.array(z.string().min(1)).min(1),
  /** [과정중심평가] 평가 내용 (평가하지 않는 차시는 "") */
  assessment: z.string(),
  /** 이 차시에서 평가하는 성취기준 id (성취기준마다 과정중심평가 1개) */
  assessFor: z.string().default(""),
  /** 이 차시에서 하는 [전단계] '하고 싶은 활동' (문구 그대로) */
  inputActivities: z.array(z.string()).default([]),
  note: z.string(),
});
export type Lesson = z.infer<typeof lessonSchema>;

export const unitSchema = z.object({
  unitName: z.string().min(1),
  /** 이 단원에 배치한 성취기준 id */
  standardIds: z.array(z.string()).default([]),
  lessons: z.array(lessonSchema).min(1),
});
export type Unit = z.infer<typeof unitSchema>;

export const planSchema = z.object({
  title: z.string().min(1),
  concept: z.string().min(1),
  units: z.array(unitSchema).min(1),
});
export type Plan = z.infer<typeof planSchema>;

/** ⑧ 평가 계획 한 줄 */
export interface AssessmentRow {
  month: string;
  standardIds: string[];
  /** 수업·평가 방법, 연계의 주안점 */
  focus: string;
  levels: { A: string; B: string; C: string };
  methods: string[];
}

/** (과목) 교수·학습 방향 및 방법, 평가 방향 및 방법 */
export interface Teaching {
  teachingDirection: string[];
  teachingMethods: string[];
  assessDirection: string[];
  assessMethods: string[];
}

export const TEXTBOOK_TYPES = {
  activity: ["기존 개발 도서(교과용 도서)", "교수학습자료(자체 제작)"],
  subject: ["기존 개발 도서(교과용 도서)", "인정 도서 (인정 신청 필요)", "교수학습자료 활용"],
} as const;

export const TEACHER_PLANS = [
  "(1안) 담임교사가 운영",
  "(2안) 교과전담교사와의 팀티칭 운영",
  "(3안) 동일교 내 동학년(군)과의 병합 수업(내부결재) 운영",
] as const;

/** 계획서(서식1)·신청서(서식3) 항목 */
export interface Application {
  schoolName: string;
  /** 과목만: 국립·공립·사립·기관 */
  establishment: string;
  englishName: string;
  textbookType: string;
  textbookName: string;
  startYear: string;
  teacherPlans: string[];
  etc: string;
  /** 계획서·신청서의 개설 필요성/목표/내용 칸 (비우면 앞 단계 내용으로 자동 작성) */
  necessity: string;
  goalSummary: string;
  contentSummary: string;
}

/** 설계 문서 전체 */
export interface DesignDoc {
  version: 1;
  basic: BasicInfo;
  input: TopicInput;
  areas: Area[];
  coreIdeas: string[];
  /** 성취기준 코드의 과목명 약어 (2~3자) */
  abbrev: string;
  standards: Standard[];
  intro: Intro;
  plan: {
    candidates: Plan[];
    demo: boolean;
    notes: string[];
    selected: Plan | null;
  };
  assessments: AssessmentRow[];
  teaching: Teaching;
  application: Application;
  /** 체크리스트(서식6·7) 교사 확인 항목 */
  checklist: Record<string, boolean>;
  /** 영역별 성취기준 수 (비어 있으면 내용 요소 수로 추천) */
  standardCounts?: (number | null)[];
  /** 어디까지 작성했는지 (다시 열면 이 단계부터) */
  progress?: { stepKey: string; maxIndex: number };
}

export function emptyDesign(): DesignDoc {
  return {
    version: 1,
    basic: {
      type: "activity",
      name: "",
      grade: 3,
      semester: 1,
      hours: 29,
      subjectGroup: "사회",
      openingType: "학교 특색교육형",
      operationMode: "지속형",
    },
    input: { topic: "", requiredContents: [], desiredActivities: [], schoolContext: "", resources: "", areaCount: null, areaNames: [] },
    areas: [],
    coreIdeas: [],
    abbrev: "",
    standards: [],
    intro: { rationale: "", overallGoal: "", detailGoals: ["", "", ""] },
    plan: { candidates: [], demo: false, notes: [], selected: null },
    assessments: [],
    teaching: { teachingDirection: [], teachingMethods: [], assessDirection: [], assessMethods: [] },
    application: {
      schoolName: "",
      establishment: "공립",
      englishName: "",
      textbookType: "",
      textbookName: "",
      startYear: "2027",
      teacherPlans: [TEACHER_PLANS[0]],
      etc: "",
      necessity: "",
      goalSummary: "",
      contentSummary: "",
    },
    checklist: {},
  };
}

export const newId = () => Math.random().toString(36).slice(2, 10);
