import type { BasicInfo, TopicInput } from "@/domain/types";
import { DESIGN_TYPES } from "@/domain/types";

/** 지도계획 3안 추천용 JSON 스키마 (Claude 구조화 출력용). 차시 번호는 코드가 계산하므로 hours만 받는다. */
export const recommendJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["plans"],
  properties: {
    plans: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "concept", "units"],
        properties: {
          title: { type: "string", description: "이 안의 짧은 이름 (예: 체험 중심안)" },
          concept: { type: "string", description: "이 안의 특징 한두 문장" },
          units: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["unitName", "lessons"],
              properties: {
                unitName: { type: "string" },
                lessons: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["hours", "topic", "goal", "activities", "assessment", "note"],
                    properties: {
                      hours: { type: "integer", description: "이 학습주제에 쓰는 차시 수" },
                      topic: { type: "string", description: "학습주제 (개괄식, 짧게)" },
                      goal: { type: "string", description: "학습 목표 문장. '~해 봅시다.'로 끝남" },
                      activities: {
                        type: "array",
                        items: { type: "string" },
                        description: "세부 학습 활동. 각각 '~하기' 형태",
                      },
                      assessment: {
                        type: "string",
                        description: "이 차시에서 과정중심평가를 하면 평가 내용, 아니면 빈 문자열",
                      },
                      note: { type: "string", description: "비고 (마을 연계, 코티칭 등). 없으면 빈 문자열" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

export const RECOMMEND_SYSTEM = `당신은 전라남도 초등학교 학교자율시간 설계를 돕는 교육과정 전문가입니다.
교사가 준 정보로 '단원 지도계획' 초안을 서로 다른 3가지 안으로 제안합니다.

지켜야 할 것:
- 서로 성격이 분명히 다른 3안을 만듭니다. (예: 탐구 중심 / 체험·프로젝트 중심 / 표현·발표 중심)
- 각 안의 모든 차시(hours)를 더한 값이 반드시 운영 시수와 정확히 같아야 합니다.
- 단원은 2~3개로 구성하고, 단원명은 그 단원이 다루는 영역을 나타내는 명사형으로 씁니다.
- 학습주제는 짧은 개괄식, 학습 목표(goal)는 '~해 봅시다.'로 끝나는 문장, 세부 활동은 '~하기'로 끝나는 구절로 씁니다.
- 교사가 준 '필수 내용'은 모든 안에 반드시 들어가야 하고, '원하는 활동'은 가능한 한 반영합니다.
- 각 단원에 과정중심평가를 하는 차시를 1개 이상 두고 assessment 칸에 평가 내용을 씁니다.
- 학년 수준에 맞는 활동을 제안합니다.
- 성취기준 코드나 성취기준 문장, 내용 체계의 내용 요소는 만들지 않습니다. (다음 단계에서 따로 정합니다)
- 정치적·종교적으로 편향되거나 특정 상업 브랜드를 홍보하는 내용은 넣지 않습니다.
- 학생 개인정보(이름 등)를 지어내거나 쓰지 않습니다.`;

export function buildRecommendUserPrompt(basic: BasicInfo, input: TopicInput): string {
  const list = (items: string[]) => (items.length ? items.map((s) => `- ${s}`).join("\n") : "(없음)");
  return `[기본 정보]
- 유형: 학교자율시간 ${DESIGN_TYPES[basic.type]}
- ${DESIGN_TYPES[basic.type]}명: ${basic.name}
- 대상: ${basic.grade}학년 ${basic.semester}학기
- 운영 시수: ${basic.hours}시간 (모든 차시 합계가 정확히 ${basic.hours}이어야 함)
- 편성 교과: ${basic.subjectGroup}
- 개설 형태: ${basic.openingType}
- 운영 방식: ${basic.operationMode}

[주제]
${input.topic}

[필수 내용]
${list(input.requiredContents)}

[원하는 활동]
${list(input.desiredActivities)}

[학교·지역 여건]
${input.schoolContext || "(없음)"}

[연계 가능한 자원(마을학교, 체험처, 인적 자원 등)]
${input.resources || "(없음)"}`;
}
