import type { z } from "zod";
import { DESIGN_TYPES, type DesignDoc } from "@/domain/types";

/**
 * 공통: 교사가 각자 쓰는 AI에 붙여 넣을 프롬프트 머리말과, 붙여 넣은 답(JSON) 읽기.
 * 앱은 AI를 직접 부르지 않는다.
 */

export type AiParse<T> = { ok: true; data: T; notes: string[] } | { ok: false; error: string };

/** 답에서 JSON 부분만 꺼낸다: ```json 블록이 있으면 그 안, 없으면 첫 { ~ 마지막 } */
export function extractJson(text: string): string | null {
  const fence = text.match(/```(?:json|JSON)?\s*([\s\S]*?)```/);
  const body = fence ? fence[1] : text;
  const start = body.search(/[[{]/);
  const end = Math.max(body.lastIndexOf("}"), body.lastIndexOf("]"));
  if (start === -1 || end <= start) return null;
  return body
    .slice(start, end + 1)
    .replace(/[“”]/g, '"') // 일부 AI·워드프로세서가 바꾸는 둥근 따옴표
    .replace(/,\s*([}\]])/g, "$1"); // 끝에 남은 쉼표
}

const FIELD_NAMES: Record<string, string> = {
  plans: "안",
  units: "단원",
  lessons: "차시",
  hours: "차시 수(hours)",
  topic: "학습주제(topic)",
  title: "안 이름(title)",
  unitName: "단원명(unitName)",
  areas: "영역",
  name: "이름(name)",
  knowledge: "지식·이해(knowledge)",
  process: "과정·기능(process)",
  values: "가치·태도(values)",
  coreIdeas: "핵심아이디어",
  standards: "성취기준",
  text: "문장(text)",
  elements: "내용 요소(elements)",
  area: "영역 번호(area)",
  rationale: "필요성/성격(rationale)",
  overallGoal: "총괄 목표(overallGoal)",
  detailGoals: "세부 목표(detailGoals)",
  assessments: "평가 계획",
  levels: "성취수준(levels)",
  focus: "수업·평가 방법(focus)",
  methods: "평가 방법(methods)",
  month: "시기(month)",
};

export function fieldName(path: PropertyKey[]): string {
  return path
    .map((p) => (typeof p === "number" ? `${p + 1}번째` : (FIELD_NAMES[String(p)] ?? String(p))))
    .join(" ");
}

/** 붙여 넣은 답을 읽어 zod 스키마로 확인한다. */
export function parseAiJson<S extends z.ZodTypeAny>(text: string, schema: S): AiParse<z.infer<S>> {
  if (!text.trim()) return { ok: false, error: "붙여 넣은 내용이 없습니다." };
  const json = extractJson(text);
  if (!json) {
    return {
      ok: false,
      error: /[[{]/.test(text)
        ? "JSON이 중간에 끊긴 것 같습니다. 답 전체를 복사했는지 확인하세요."
        : "답에서 JSON 코드 블록을 찾지 못했습니다.",
    };
  }
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { ok: false, error: "JSON 형식이 깨져 있습니다. (답이 중간에 끊겼거나 괄호·따옴표가 빠졌을 수 있습니다)" };
  }
  const r = schema.safeParse(data);
  if (!r.success) {
    const issue = r.error.issues[0];
    return { ok: false, error: `${fieldName(issue.path)} 칸이 비었거나 형식이 맞지 않습니다.` };
  }
  return { ok: true, data: r.data, notes: [] };
}

/** 문자열 배열 또는 줄바꿈 문자열을 너그럽게 받아 배열로 */
export const toList = (v: unknown): string[] => {
  const arr = Array.isArray(v) ? v : typeof v === "string" ? v.split("\n") : [];
  return arr
    .map((s) => String(s).trim().replace(/^[-·⋅•▫]\s*/, ""))
    .filter(Boolean);
};

/** 학년별 수준 안내 (모든 프롬프트에 넣어 학년에 맞는 내용·낱말·활동이 나오게 함) */
export function gradeGuide(grade: number): string {
  const byGrade: Record<number, string> = {
    3: "3학년(3~4학년군 시작): 가정·학교·고장 등 가까운 생활 속 소재, 직접 보고 만지고 해 보는 구체적 체험·놀이 중심, 짧고 쉬운 낱말. 개념은 '알아보기·찾아보기' 수준으로 간단히.",
    4: "4학년(3~4학년군): 고장·지역으로 범위를 넓히고, 간단한 조사·비교·분류와 쉬운 자료 정리(표·그림), 모둠 활동을 시작하는 수준. 추상적 개념은 구체적 사례로 풀어서.",
    5: "5학년(5~6학년군 시작): 지역·국가로 범위 확장, 자료를 찾아 정리·분석하고 까닭을 설명하기, 모둠 프로젝트와 발표. 개념과 원리를 사례와 연결해 이해하는 수준.",
    6: "6학년(5~6학년군): 국가·세계로 범위 확장, 탐구·토의·토론과 문제 해결, 디지털 도구로 결과물을 만들어 공유하기, 가치를 판단하고 실천을 다짐하는 수준.",
  };
  return `- ${byGrade[grade] ?? `${grade}학년 수준`}
- 같은 학년(군) 교과 교육과정의 성취기준 수준을 넘지 않게 하고, 어려운 한자어·전문 용어는 쉬운 말로 바꿉니다.
- 한 차시(40분)에 이 학년 학생이 해낼 수 있는 분량과 난이도로 제안합니다.`;
}

/** 모든 프롬프트 앞부분: 역할 + 기본 정보 + [전단계] 주제와 활동 내용 */
export function contextBlock(doc: Pick<DesignDoc, "basic" | "input">): string {
  const { basic, input } = doc;
  const kind = DESIGN_TYPES[basic.type];
  const list = (items: string[]) => (items.length ? items.map((s) => `- ${s}`).join("\n") : "- (없음)");
  return `당신은 전라남도 초등학교 학교자율시간 설계를 돕는 교육과정 전문가입니다.
「2027학년도 초등 학교자율시간 설계·운영 지침」과 2022 개정 교육과정 문서 체제를 따릅니다.

## 기본 정보
- 유형: 학교자율시간 ${kind}
- ${kind}명: ${basic.name}
- 대상: ${basic.grade}학년 ${basic.semester}학기
- 운영 시수: ${basic.hours}시간
- 편성 교과: ${basic.subjectGroup}
- 개설 형태: ${basic.openingType}
- 운영 방식: ${basic.operationMode}

## 주제
${input.topic}

## 꼭 들어가야 할 내용
${list(input.requiredContents)}

## 하고 싶은 활동
${list(input.desiredActivities)}

## 학교·지역 여건
${input.schoolContext || "(없음)"}

## 연계 가능한 자원 (마을학교, 체험처, 인적 자원 등)
${input.resources || "(없음)"}

## 학년 수준 (꼭 고려)
${gradeGuide(basic.grade)}`;
}

export const COMMON_RULES = `- 정치적·종교적으로 편향된 내용, 특정 상업 브랜드 홍보, 학생 개인정보는 넣지 않습니다.
- 다른 사람의 저작물을 그대로 옮기지 않습니다.`;

export function formatBlock(example: string, extra = ""): string {
  return `## 답하는 형식 (아주 중요)
설명 없이 아래 모양의 JSON 코드 블록 하나만 답하세요. 키 이름은 영어 그대로 두고, 값만 한국어로 채웁니다.${extra ? `\n${extra}` : ""}

\`\`\`json
${example}
\`\`\``;
}

/** 붙여 넣은 답을 읽지 못했을 때, 교사가 같은 AI 대화창에 이어서 보낼 수정 요청 */
export function buildFixPrompt(problem: string, reminder: string): string {
  return `방금 답에 문제가 있어 프로그램이 읽지 못했습니다.
문제: ${problem}

앞의 규칙을 그대로 지켜서 다시 답해 주세요.
- 설명 없이 \`\`\`json 코드 블록 하나만 답합니다.
- 키 이름은 바꾸지 않습니다.
${reminder}`;
}
