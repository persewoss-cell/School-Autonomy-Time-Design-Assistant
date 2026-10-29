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

/** ② 주제와 내용 (학생 개인정보 입력 칸 없음) */
export const topicInputSchema = z.object({
  topic: z.string().trim().min(2, "주제를 입력해 주세요.").max(200),
  requiredContents: z.array(z.string().trim().min(1).max(200)).max(15),
  desiredActivities: z.array(z.string().trim().min(1).max(200)).max(15),
  schoolContext: z.string().trim().max(1000),
  resources: z.string().trim().max(1000),
});
export type TopicInput = z.infer<typeof topicInputSchema>;

/** 단원 지도계획 — 차시 번호는 코드가 hours로 계산한다 (AI가 번호를 정하지 않음) */
export const lessonSchema = z.object({
  hours: z.number().int().min(1).max(10),
  topic: z.string().min(1),
  goal: z.string().min(1),
  activities: z.array(z.string().min(1)).min(1),
  assessment: z.string(),
  note: z.string(),
});
export type Lesson = z.infer<typeof lessonSchema>;

export const unitSchema = z.object({
  unitName: z.string().min(1),
  lessons: z.array(lessonSchema).min(1),
});
export type Unit = z.infer<typeof unitSchema>;

export const planSchema = z.object({
  title: z.string().min(1),
  concept: z.string().min(1),
  units: z.array(unitSchema).min(1),
});
export type Plan = z.infer<typeof planSchema>;

export const recommendResponseSchema = z.object({
  plans: z.array(planSchema).length(3),
});
