import { describe, expect, it } from "vitest";
import { extractJson, parsePlans } from "./parsePlans";
import { buildPlanPrompt } from "./planPrompt";
import type { BasicInfo } from "@/domain/types";

const lesson = { hours: 2, topic: "주제", goal: "알아봅시다.", activities: ["조사하기"], assessment: "", note: "" };
const plan = (title: string) => ({ title, concept: "특징", units: [{ unitName: "단원", lessons: [lesson] }] });
const answer = { plans: [plan("가"), plan("나"), plan("다")] };

describe("parsePlans", () => {
  it("```json 코드 블록과 앞뒤 설명이 있어도 읽는다", () => {
    const text = `네, 3안입니다.\n\`\`\`json\n${JSON.stringify(answer, null, 2)}\n\`\`\`\n도움이 되길 바랍니다.`;
    const r = parsePlans(text);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.plans.map((p) => p.title)).toEqual(["가", "나", "다"]);
  });

  it("코드 블록 없이 JSON만 있어도 읽는다", () => {
    expect(parsePlans(JSON.stringify(answer)).ok).toBe(true);
  });

  it("plans 없이 배열만 줘도 읽는다", () => {
    expect(parsePlans(JSON.stringify(answer.plans)).ok).toBe(true);
  });

  it("숫자 문자열, 빠진 assessment/note, 끝 쉼표, 둥근 따옴표를 너그럽게 받는다", () => {
    const text = `{"plans":[{"title":"가","concept":"c","units":[{"unitName":"u","lessons":[{"hours":"3","topic":"t","goal":"g","activities":"- 조사하기\\n- 발표하기",},]}]}]}`
      .replace('"title"', "“title”");
    const r = parsePlans(text);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const l = r.plans[0].units[0].lessons[0];
      expect(l.hours).toBe(3);
      expect(l.activities).toEqual(["조사하기", "발표하기"]);
      expect(l.assessment).toBe("");
      expect(r.notes[0]).toContain("1개 안만");
    }
  });

  it("4개 이상이면 앞의 3개만", () => {
    const r = parsePlans(JSON.stringify({ plans: [plan("1"), plan("2"), plan("3"), plan("4")] }));
    expect(r.ok && r.plans.length).toBe(3);
  });

  it("JSON이 끊기면 알기 쉬운 오류", () => {
    const r = parsePlans('```json\n{"plans": [{"title": "가", "units": [\n```');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("JSON");
  });

  it("빈 칸이 있으면 어느 칸인지 알려 줌", () => {
    const bad = { plans: [{ ...plan("가"), units: [{ unitName: "u", lessons: [{ ...lesson, topic: "" }] }] }] };
    const r = parsePlans(JSON.stringify(bad));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("학습주제");
  });

  it("빈 입력", () => {
    expect(parsePlans("  ").ok).toBe(false);
  });
});

describe("extractJson", () => {
  it("JSON이 없으면 null", () => {
    expect(extractJson("죄송하지만 도와드릴 수 없습니다.")).toBeNull();
  });
});

describe("buildPlanPrompt", () => {
  it("입력값과 시수 규칙이 프롬프트에 들어간다", () => {
    const basic: BasicInfo = {
      type: "subject",
      name: "지구마을 첫걸음",
      grade: 3,
      semester: 2,
      hours: 29,
      subjectGroup: "사회",
      openingType: "학교 특색교육형",
      operationMode: "지속형",
    };
    const p = buildPlanPrompt(basic, {
      topic: "세계시민",
      requiredContents: ["문화 다양성"],
      desiredActivities: ["역할극"],
      schoolContext: "",
      resources: "",
    });
    expect(p).toContain("학교자율시간 과목");
    expect(p).toContain("정확히 29");
    expect(p).toContain("- 문화 다양성");
    expect(p).toContain("```json");
  });
});
