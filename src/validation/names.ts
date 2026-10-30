/** 이름 비교용: 띄어쓰기를 모두 빼고 본다 ("자전거 하이킹" = "자전거하이킹") */
export const nameKey = (name: string) => name.replace(/\s+/g, "");

export interface NamedDesign {
  name: string;
  type: "subject" | "activity";
  grade: number;
  semester: number;
}

/**
 * 교내 이름 중복: 같은 학교·같은 학년도의 다른 설계(과목·활동 모두)와 이름이 같으면 안 된다.
 * 학년이 달라도 안 되고, 띄어쓰기는 무시한다. (과목은 이와 별도로 전국 과목명 중복을 에듀넷에서 확인)
 * others: 같은 학교·같은 학년도의 다른 설계
 */
export function findSameName<T extends NamedDesign>(name: string, others: T[]): T | null {
  const key = nameKey(name);
  if (!key) return null;
  return others.find((o) => nameKey(o.name) === key) ?? null;
}

/** 이름 칸 아래 짧은 경고 */
export function sameNameMessage(same: NamedDesign): string {
  return `같은 학년도에 이미 「${same.name}」 ${same.type === "subject" ? "과목" : "활동"}이 있어요. (${same.grade}학년 ${same.semester}학기)`;
}
