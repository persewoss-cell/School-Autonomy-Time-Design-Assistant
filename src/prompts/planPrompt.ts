import type { BasicInfo, TopicInput } from "@/domain/types";
import { DESIGN_TYPES } from "@/domain/types";

/**
 * 교사가 각자 쓰는 AI(ChatGPT, Claude, Gemini 등)에 붙여 넣을 '단원 지도계획 3안' 프롬프트.
 * 앱은 AI를 직접 부르지 않는다. 답은 교사가 다시 붙여 넣고, parsePlans.ts가 읽어서 코드로 검사한다.
 */
export function buildPlanPrompt(basic: BasicInfo, input: TopicInput): string {
  const kind = DESIGN_TYPES[basic.type];
  const list = (items: string[]) => (items.length ? items.map((s) => `- ${s}`).join("\n") : "- (없음)");

  return `당신은 전라남도 초등학교 학교자율시간 설계를 돕는 교육과정 전문가입니다.
아래 정보로 학교자율시간 ${kind}의 '단원 지도계획' 초안을 서로 다른 3가지 안으로 만들어 주세요.

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

## 반드시 지킬 규칙
1. 성격이 분명히 다른 3안을 만듭니다. (예: 탐구 중심 / 체험·프로젝트 중심 / 표현·발표 중심)
2. 한 안의 모든 차시(hours)를 더한 값은 반드시 정확히 ${basic.hours}이어야 합니다. 답하기 전에 직접 더해서 확인하세요.
3. 단원은 2~3개로 나누고, 단원명은 그 단원이 다루는 영역을 나타내는 명사형으로 씁니다.
4. 학습주제(topic)는 짧은 개괄식으로 씁니다.
5. 학습 목표(goal)는 '~해 봅시다.'로 끝나는 한 문장으로 씁니다.
6. 세부 활동(activities)은 2~4개, 각각 '~하기'로 끝나는 구절로 씁니다.
7. '꼭 들어가야 할 내용'은 모든 안에 반드시 넣고, '하고 싶은 활동'은 가능한 한 반영합니다.
8. 단원마다 과정중심평가를 하는 차시를 1개 이상 두고, 그 차시의 assessment에 평가 내용을 씁니다. 평가하지 않는 차시는 빈 문자열("")로 둡니다.
9. note(비고)에는 마을 연계, 코티칭, 원어민 연계 등을 쓰고, 없으면 빈 문자열("")로 둡니다.
10. ${basic.grade}학년 수준에 맞는 활동을 제안합니다.
11. 성취기준 코드, 성취기준 문장, 내용 요소는 만들지 않습니다. (다음 단계에서 따로 정합니다)
12. 정치적·종교적으로 편향된 내용, 특정 상업 브랜드 홍보, 학생 개인정보는 넣지 않습니다.

## 답하는 형식 (아주 중요)
설명 없이 아래 모양의 JSON 코드 블록 하나만 답하세요. 키 이름은 영어 그대로 두고, 값만 한국어로 채웁니다.

\`\`\`json
{
  "plans": [
    {
      "title": "탐구 중심안",
      "concept": "이 안의 특징을 한두 문장으로",
      "units": [
        {
          "unitName": "단원명",
          "lessons": [
            {
              "hours": 2,
              "topic": "학습주제",
              "goal": "~에 대해 알아봅시다.",
              "activities": ["~ 조사하기", "~ 발표하기"],
              "assessment": "",
              "note": ""
            }
          ]
        }
      ]
    }
  ]
}
\`\`\`

plans에는 3개의 안이 들어가야 합니다.`;
}

/** 붙여 넣은 답을 읽지 못했을 때, 교사가 같은 AI 대화창에 이어서 보낼 수정 요청 */
export function buildFixPrompt(problem: string, hours: number): string {
  return `방금 답에 문제가 있어 프로그램이 읽지 못했습니다.
문제: ${problem}

앞의 규칙을 그대로 지켜서 다시 답해 주세요.
- 설명 없이 \`\`\`json 코드 블록 하나만 답합니다.
- 키 이름(plans, title, concept, units, unitName, lessons, hours, topic, goal, activities, assessment, note)은 바꾸지 않습니다.
- plans에는 3개의 안이 있어야 하고, 각 안의 hours 합계는 정확히 ${hours}이어야 합니다.`;
}
