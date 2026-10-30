import type { Issue } from "./types";

/** 이름 비교용: 띄어쓰기를 모두 빼고 본다 ("자전거 하이킹" = "자전거하이킹") */
export const nameKey = (name: string) => name.replace(/\s+/g, "");

/**
 * 활동명 중복: 같은 학교·같은 학년도에 같은 활동명은 쓸 수 없다 (다른 학년이어도).
 * others: 같은 학교·같은 학년도의 다른 활동 설계
 */
export function checkActivityName(name: string, others: { name: string; grade: number; semester: number }[]): Issue[] {
  const key = nameKey(name);
  if (!key) return [];
  const same = others.find((o) => nameKey(o.name) === key);
  if (!same) return [];
  return [
    {
      level: "error",
      field: "활동명",
      message: `같은 학년도에 이미 「${same.name}」(${same.grade}학년 ${same.semester}학기) 활동이 있습니다. 같은 학교·같은 학년도에는 학년이 달라도 같은 활동명을 쓸 수 없습니다. (띄어쓰기만 다른 것도 같은 이름으로 봅니다)`,
      fix: "활동명을 바꿔 주세요. 예: 자전거 하이킹3, 자전거 하이킹4처럼 학년을 붙여 구분",
      step: "basic",
    },
  ];
}
