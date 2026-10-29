import type { BasicInfo, Lesson, Plan, TopicInput } from "@/domain/types";

/**
 * 체험 모드(API 키 없음)용 예시 3안. 입력한 주제·필수 내용·원하는 활동을 끼워 넣어
 * 화면 흐름을 확인할 수 있게 한다. 차시 합계는 항상 운영 시수와 같다.
 */
export function makeDemoPlans(basic: BasicInfo, input: TopicInput): Plan[] {
  const topic = input.topic;
  const must = input.requiredContents.length ? input.requiredContents : [`${topic}의 의미`];
  const wants = input.desiredActivities.length ? input.desiredActivities : ["모둠 발표"];

  const styles = [
    { title: "탐구 중심안", concept: `${topic}을(를) 조사·탐구하며 개념을 깊이 이해하는 데 중점을 둡니다.`, verb: "조사하기" },
    { title: "체험·프로젝트 중심안", concept: `지역 자원과 연계한 체험과 모둠 프로젝트로 ${topic}을(를) 직접 실천합니다.`, verb: "체험하기" },
    { title: "표현·발표 중심안", concept: `배운 내용을 다양한 방법으로 표현하고 공유하는 활동에 중점을 둡니다.`, verb: "표현하기" },
  ];

  return styles.map((s, si) => {
    // 운영 시수를 두 단원에 나누고, 각 단원을 1~3차시짜리 학습주제로 쪼갠다.
    const firstHalf = Math.ceil(basic.hours / 2);
    const unitHours = [firstHalf, basic.hours - firstHalf];
    const unitNames = [`${topic} 이해하기`, `${topic} 실천하기`];
    return {
      title: s.title,
      concept: s.concept,
      units: unitHours.map((h, ui) => {
        const lessons: Lesson[] = [];
        let left = h;
        let k = 0;
        while (left > 0) {
          const size = Math.min(left, ((k + si) % 3) + 1);
          const item = ui === 0 ? must[k % must.length] : wants[k % wants.length];
          lessons.push({
            hours: size,
            topic: ui === 0 ? `${item} 알아보기` : `${item}`,
            goal: ui === 0 ? `${item}에 대해 알아봅시다.` : `${item} 활동에 참여해 봅시다.`,
            activities: [`${item} 관련 자료 ${s.verb}`, "알게 된 점을 친구와 이야기하기"],
            assessment: "",
            note: ui === 1 && k === 0 && input.resources ? "지역 자원 연계" : "",
          });
          left -= size;
          k += 1;
        }
        lessons[lessons.length - 1].assessment = `[과정중심평가] ${unitNames[ui]} 결과를 정리하여 발표하기`;
        return { unitName: unitNames[ui], lessons };
      }),
    };
  });
}
