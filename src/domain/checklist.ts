/**
 * 체크리스트 — [서식6] 활동 개설 체크리스트 / [서식7] 과목 개설 체크리스트.
 * auto 항목은 프로그램 점검 결과로 판정하고, 나머지는 교사가 직접 확인한다.
 */
export interface ChecklistItem {
  id: string;
  area: string;
  /** 서식의 평가 지표 문구 */
  label: (kind: "과목" | "활동") => string;
  /** 프로그램이 판정하는 항목이면 관련 단계 */
  auto?: "name" | "hours" | "content" | "standards" | "plan" | "intro" | "textbook" | "teacher";
  subjectOnly?: boolean;
  activityOnly?: boolean;
}

export const CHECKLIST: ChecklistItem[] = [
  { id: "name", area: "명칭", label: (k) => `${k}명이 적절한가?` },
  { id: "nameDup", area: "명칭", label: () => "활동명이 학교 내에서 중복되지 않았는가?", activityOnly: true },
  { id: "nameDupNation", area: "명칭", label: () => "과목명이 타학교(타시도 포함) 과목과 중복되지 않았는가? (에듀넷 티클리어 확인)", subjectOnly: true },
  { id: "group", area: "관련 교과(군)", label: () => "관련 교과(군)이 적절한가?" },
  { id: "range", area: "관련 교과(군)", label: () => "관련 교과(군)의 20% 시수 증감 범위 내에서 시수를 편성하였는가? (시수 점검 메뉴)" },
  { id: "noOverCut", area: "관련 교과(군)", label: () => "시수 확보 과정에서 특정 교과나 창의적 체험활동 시수가 지나치게 감축되지 않았는가?" },
  { id: "week", area: "수업 시간 확보", label: () => "연간 34주 기준으로 학기별 1주의 수업 시간을 확보(학기 단위 운영)하였는가?", auto: "hours" },
  { id: "achieve", area: "수업 시간 확보", label: () => "감축된 수업 시수로 인해 성취기준 이수에 지장이 없는가?" },
  { id: "min10", area: "수업 시간 확보", label: (k) => `한 ${k}의 최소 운영 시수인 10차시 이상으로 편성하였는가?`, auto: "hours" },
  { id: "max3", area: "수업 시간 확보", label: () => "학교자율시간 운영 (활동/과목) 수(최대 3개 이내)를 확인하였는가?" },
  { id: "intro", area: "필요성, 목표, 내용", label: () => "개설의 필요성, 목표, 내용을 충실하게 작성하였는가?", auto: "intro" },
  { id: "textbook", area: "교재", label: () => "교재(교과용 도서 또는 교수·학습 자료) 활용 계획이 있는가?", auto: "textbook" },
  { id: "teacher", area: "지도교사", label: () => "지도교사 확보 방안이 마련되어 있는가?", auto: "teacher" },
  { id: "content", area: "내용 체계 및 성취기준", label: () => "내용 체계 및 성취기준을 구체적으로 작성하였는가?", auto: "standards" },
  { id: "newSystem", area: "내용 체계 및 성취기준", label: () => "교육과정에 제시된 교과 외 새로운 내용 체계로 구성하였는가?" },
  { id: "level", area: "내용 체계 및 성취기준", label: () => "학생 발달 단계에 맞는 성취기준을 개발하였는가?" },
  { id: "plan", area: "지도의 실제", label: () => "차시별 지도 계획과 평가 계획을 구체적으로 작성하였는가?", auto: "plan" },
  { id: "neutral", area: "기타", label: () => "정치적·파당적·개인적 편견을 전파하거나 특정 종교교육을 위한 방편으로 이용될 수 있는 내용이 없는가?" },
  { id: "ip", area: "기타", label: () => "타인의 저작물을 표절 또는 모작한 내용은 없는가?" },
  { id: "constitution", area: "기타", label: () => "대한민국의 헌법 이념 및 가치 존중에 위배되는 내용은 없는가?" },
];

export function checklistFor(type: "subject" | "activity"): ChecklistItem[] {
  return CHECKLIST.filter((i) => (type === "subject" ? !i.activityOnly : !i.subjectOnly));
}
