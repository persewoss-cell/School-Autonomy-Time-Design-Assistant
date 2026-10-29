import type { DesignDoc } from "./types";

/** 계획서(서식1)·신청서(서식3)의 개설 필요성·목표·내용 칸 자동 작성 (교사가 고치면 그 값을 씀) */
export function applicationTexts(doc: DesignDoc) {
  const a = doc.application;
  const autoNecessity = [
    "1. 2022 개정 교육과정에 따른 지역적·문화적 여건을 반영한 학교자율시간 " + (doc.basic.type === "subject" ? "과목" : "활동") + " 운영",
    "2. 지역과 학교의 여건 및 학생의 필요를 반영한 특색 있는 교육과정 운영",
    ...(doc.intro.rationale.trim() ? ["3. " + firstSentence(doc.intro.rationale)] : []),
  ].join("\n");
  const autoGoal = [doc.intro.overallGoal, ...doc.intro.detailGoals.filter(Boolean).map((g, i) => `(${i + 1}) ${g}`)]
    .filter((s) => s.trim())
    .join("\n");
  const autoContent = doc.areas
    .map((ar, i) => `(${i + 1}) ${ar.name}: ${[...ar.knowledge, ...ar.process].map((s) => s.trim()).filter(Boolean).join(", ")}`)
    .join("\n");
  return {
    necessity: a.necessity.trim() || autoNecessity,
    goal: a.goalSummary.trim() || autoGoal,
    content: a.contentSummary.trim() || autoContent,
    autoNecessity,
    autoGoal,
    autoContent,
  };
}

function firstSentence(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  const m = t.match(/^.*?다\./);
  return (m ? m[0] : t).slice(0, 200);
}
