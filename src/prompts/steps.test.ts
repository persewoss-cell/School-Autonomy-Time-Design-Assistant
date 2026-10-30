import { describe, expect, it } from "vitest";
import { sampleSubject } from "@/domain/sample";
import { extractJson } from "./common";
import {
  assessmentPrompt,
  contentSystemPrompt,
  coreIdeasPrompt,
  introPrompt,
  planPrompt,
  standardsPrompt,
  teachingPrompt,
} from "./steps";

const doc = sampleSubject();
const wrap = (o: unknown) => `네, 작성했습니다.\n\`\`\`json\n${JSON.stringify(o, null, 2)}\n\`\`\`\n도움이 되길 바랍니다.`;

describe("공통 읽기", () => {
  it("JSON이 없으면 null", () => {
    expect(extractJson("죄송하지만 도와드릴 수 없습니다.")).toBeNull();
  });
  it("끊긴 답은 알기 쉬운 오류", () => {
    const r = contentSystemPrompt.parse('```json\n{"areas": [{"name": "가",', doc);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("끊긴");
  });
  it("둥근 따옴표, 끝 쉼표도 읽는다", () => {
    const r = coreIdeasPrompt.parse('{“coreIdeas”: ["문화는 다양하다.", ]}', doc);
    expect(r.ok && r.data).toEqual(["문화는 다양하다."]);
  });
});

describe("내용 체계", () => {
  it("프롬프트에 주제와 서술어미 규칙이 들어간다", () => {
    const p = contentSystemPrompt.build(doc);
    expect(p).toContain("지구마을 첫걸음");
    expect(p).toContain("'~하기'로 끝냄");
  });
  it("줄바꿈 문자열·글머리표도 목록으로 읽는다", () => {
    const r = contentSystemPrompt.parse(wrap({ areas: [{ name: "평화", knowledge: "· 평화의 중요성\n· 다양한 세계", process: ["탐구하기"], values: ["존중"] }] }), doc);
    expect(r.ok && r.data[0].knowledge).toEqual(["평화의 중요성", "다양한 세계"]);
  });
});

describe("성취기준 — AI가 지어낸 내용 요소 걸러 내기", () => {
  it("내용 체계에 없는 내용 요소는 빼고 알린다, 코드는 무시", () => {
    const r = standardsPrompt.parse(
      wrap({
        standards: [
          { area: 1, text: "[3사지구01-01] 세계와 연결된 나의 삶을 이해한다.", elements: ["세계와연결된 나의 삶", "지어낸 내용 요소"] },
          { area: 9, text: "없는 영역", elements: [] },
        ],
      }),
      doc,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data).toHaveLength(1);
      expect(r.data[0].text).toBe("세계와 연결된 나의 삶을 이해한다.");
      expect(r.data[0].elements).toEqual(["세계와 연결된 나의 삶"]); // 띄어쓰기는 원래 문구로
      expect(r.notes.join()).toContain("지어낸 내용 요소");
      expect(r.notes.join()).toContain("영역 번호 9");
    }
  });
});

describe("목표", () => {
  it("세부 목표가 3개 미만이면 오류", () => {
    const r = introPrompt.parse(wrap({ rationale: "가", overallGoal: "나", detailGoals: ["1", "2"] }), doc);
    expect(r.ok).toBe(false);
  });
  it("과목은 '성격' 규칙", () => {
    expect(introPrompt.build(doc)).toContain("'성격'");
  });
});

describe("단원 지도계획 — 목록 밖 성취기준 코드 걸러 내기", () => {
  const lesson = { hours: "12", topic: "주제", goal: "", activities: "조사하기", assessment: "[과정중심평가] 발표" };
  it("코드를 id로 바꾸고 모르는 코드는 뺀다", () => {
    const r = planPrompt.parse(
      wrap({ plans: [{ title: "가", units: [{ unitName: "단원", standards: ["[3사지구01-01]", "[3 사지구02-02]", "[9국가짜01-01]"], lessons: [lesson] }] }] }),
      doc,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data[0].units[0].standardIds).toEqual(["s1", "s4"]);
      const l = r.data[0].units[0].lessons[0];
      expect(l.hours).toBe(12);
      expect(l.assessment).toBe("발표");
      expect(r.notes.join()).toContain("[9국가짜01-01]");
      expect(r.notes.join()).toContain("1개 안만");
    }
  });
  it("프롬프트에 성취기준 코드와 시수가 들어간다", () => {
    const p = planPrompt.build(doc);
    expect(p).toContain("[3사지구02-02]");
    expect(p).toContain("정확히 29");
  });
});

describe("평가 계획", () => {
  it("월 숫자, 코드 변환", () => {
    const r = assessmentPrompt.parse(
      wrap({ assessments: [{ month: 9, standards: ["[3사지구01-01]"], focus: "f", levels: { A: "a", B: "b", C: "c" }, methods: "관찰평가" }] }),
      doc,
    );
    expect(r.ok && r.data[0]).toEqual({
      month: "9월",
      standardIds: ["s1"],
      focus: "f",
      levels: { A: "a", B: "b", C: "c" },
      methods: ["관찰평가"],
    });
  });
  it("프롬프트에 단원 지도계획의 과정중심평가가 들어간다", () => {
    expect(assessmentPrompt.build(doc)).toContain("세계시민 규칙과 실천 약속을 정해 발표하기");
  });
});

describe("교수·학습", () => {
  it("네 목록을 읽는다", () => {
    const r = teachingPrompt.parse(wrap({ teachingDirection: ["a"], teachingMethods: ["b"], assessDirection: ["c"], assessMethods: ["d"] }), doc);
    expect(r.ok).toBe(true);
  });
});

describe("영역 수·영역명과 학년 수준", () => {
  const withAreas = (count: number | null, names: string[]) => {
    const d = sampleSubject();
    d.input = { ...d.input, areaCount: count, areaNames: names };
    return d;
  };
  it("정해 둔 영역 수와 영역명이 프롬프트에 들어간다", () => {
    const p = contentSystemPrompt.build(withAreas(3, ["경제생활과 소득"]));
    expect(p).toContain("영역은 정확히 3개");
    expect(p).toContain("(1) 경제생활과 소득");
    expect(p).toContain("나머지 2개 영역의 이름은 주제에 맞게");
  });
  it("비워 두면 AI가 2~3개로 정한다", () => {
    expect(contentSystemPrompt.build(withAreas(null, []))).toContain("2~3개로 나눕니다");
  });
  it("영역명만 2개 적으면 2개로", () => {
    expect(contentSystemPrompt.build(withAreas(null, ["가", "나"]))).toContain("영역은 정확히 2개");
  });
  it("오래된 저장본(영역 칸 없음)도 동작", () => {
    const d = sampleSubject();
    d.input = { ...d.input } as typeof d.input;
    delete (d.input as Partial<typeof d.input>).areaNames;
    delete (d.input as Partial<typeof d.input>).areaCount;
    expect(contentSystemPrompt.build(d)).toContain("2~3개로 나눕니다");
  });
  it("영역 수·영역명이 다르게 오면 알려 준다", () => {
    const r = contentSystemPrompt.parse(wrap({ areas: [{ name: "다른 이름", knowledge: ["a"], process: ["b하기"], values: ["c"] }] }), withAreas(2, ["세계시민의 이해"]));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.notes.join()).toContain("2개로 정했는데 AI가 1개");
      expect(r.notes.join()).toContain("세계시민의 이해");
    }
  });
  it("모든 단계 프롬프트에 학년 수준 안내가 들어간다", () => {
    const d = sampleSubject();
    for (const p of [contentSystemPrompt, coreIdeasPrompt, standardsPrompt, introPrompt, planPrompt, assessmentPrompt, teachingPrompt]) {
      expect(p.build(d)).toContain("## 학년 수준 (꼭 고려)");
    }
    expect(contentSystemPrompt.build(d)).toContain("3학년(3~4학년군 시작)");
    d.basic.grade = 6;
    expect(planPrompt.build(d)).toContain("6학년(5~6학년군)");
  });
});

describe("영역별 성취기준 수", () => {
  it("내용 요소 수로 추천: 5개→2, 4개→2, 9개→4, 최소 2", async () => {
    const { recommendedStandardCount } = await import("@/domain/standardCounts");
    const area = (n: number) => ({ name: "a", knowledge: Array(n).fill("x"), process: [], values: [] });
    expect([5, 4, 9, 1, 0].map((n) => recommendedStandardCount(area(n)))).toEqual([2, 2, 4, 2, 2]);
  });
  it("정한 개수가 프롬프트에 들어가고, 다르게 오면 알림", () => {
    const d = sampleSubject();
    d.standardCounts = [3, null];
    const p = standardsPrompt.build(d);
    expect(p).toContain("- (1) 세계시민의 이해: 3개");
    expect(p).toContain("- (2) 문화 다양성과 존중: 2개");
    const r = standardsPrompt.parse(wrap({ standards: [{ area: 1, text: "가.", elements: ["세계와 연결된 나의 삶"] }, { area: 2, text: "나.", elements: ["세계의 다양한 문화"] }, { area: 2, text: "다.", elements: ["세계의 다양한 문화"] }] }), d);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.notes.join()).toContain("3개로 정했는데 AI가 1개");
      expect(r.notes.join()).not.toContain("(2) 문화 다양성과 존중:");
    }
  });
});
