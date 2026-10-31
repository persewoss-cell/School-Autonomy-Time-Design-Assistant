import { describe, expect, it } from "vitest";
import { sampleSubject } from "@/domain/sample";
import { extractJson } from "./common";
import {
  assessmentPrompt,
  contentSystemPrompt,
  coreIdeasPrompt,
  introPrompt,
  planPrompt,
  reviseStandardsPrompt,
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

describe("성취기준 — 내용 요소는 한 성취기준에만", () => {
  it("겹친 내용 요소는 처음 것에만 남기고 알림", () => {
    const r = standardsPrompt.parse(
      wrap({
        standards: [
          { area: 1, text: "가.", elements: ["세계와 연결된 나의 삶", "세계시민 규칙 정하기"] },
          { area: 1, text: "나.", elements: ["세계와 연결된 나의 삶", "세계 어린이의 생활 탐구하기"] },
        ],
      }),
      doc,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data[1].elements).toEqual(["세계 어린이의 생활 탐구하기"]);
      expect(r.notes.join()).toContain("겹쳐 들어간 내용 요소");
    }
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
  it("n번째 단원에는 n번째 영역의 성취기준이 들어간다 (AI가 적은 코드와 관계없이)", () => {
    const r = planPrompt.parse(
      wrap({ plans: [{ title: "가", units: [{ unitName: "단원", standards: ["[3사지구01-01]", "[3 사지구02-02]", "[9국가짜01-01]"], lessons: [lesson] }] }] }),
      doc,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      // 1단원 = 1영역의 성취기준 (AI가 다른 영역 코드를 적어도 영역 기준으로 맞춤)
      expect(r.data[0].units[0].standardIds).toEqual(doc.standards.filter((x) => x.areaIndex === 0).map((x) => x.id));
      const l = r.data[0].units[0].lessons[0];
      expect(l.hours).toBe(12);
      expect(l.assessment).toBe("발표");
      expect(r.notes.join()).toContain("1개 안만");
    }
  });
  it("평가 성취기준 코드와 전단계 활동 번호를 읽고, 빠진 것을 알린다", () => {
    const r = planPrompt.parse(
      wrap({
        plans: [
          {
            title: "가",
            units: [
              {
                unitName: "단원",
                standards: ["[3사지구01-01]"],
                lessons: [
                  { hours: 29, topic: "주제", activities: ["하기"], fromActivities: [1, "문화 존중 역할극", 9], assessStandard: "[3사지구01-01]", assessment: "발표" },
                ],
              },
            ],
          },
        ],
      }),
      doc,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      const l = r.data[0].units[0].lessons[0];
      expect(l.assessFor).toBe("s1");
      expect(l.inputActivities).toEqual(["세계시민 여권 만들기", "문화 존중 역할극"]);
      expect(r.notes.join()).toContain("전단계 활동이 빠졌습니다 — 언어 어울림(이중언어) 발표회");
      expect(r.notes.join()).toContain("[3사지구01-02]");
    }
  });
  it("프롬프트에 전단계 활동 번호와 성취기준당 과정중심평가 1개 규칙이 들어간다", () => {
    const p = planPrompt.build(doc);
    expect(p).toContain("1. 세계시민 여권 만들기");
    expect(p).toContain("성취기준 하나에 정확히 1개");
    expect(p).toContain("과정중심평가 차시가 정확히 4개");
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
  const area = (k: number, p: number, v: number) => ({
    name: "a",
    knowledge: Array.from({ length: k }, (_, i) => `지식${i}`),
    process: Array.from({ length: p }, (_, i) => `과정${i}하기`),
    values: Array.from({ length: v }, (_, i) => `태도${i}`),
  });
  it("범위: 서로 다른 범주끼리 2~3개씩 → 최소 max(⌈n÷3⌉, 가장 많은 범주 수), 최대 ⌊n÷2⌋", async () => {
    const { standardCountRange } = await import("@/domain/standardCounts");
    expect([area(1, 1, 1), area(2, 2, 1), area(2, 2, 2), area(3, 2, 2), area(3, 3, 3), area(4, 3, 3), area(1, 2, 1)].map(standardCountRange)).toEqual([
      { min: 1, max: 1 },
      { min: 2, max: 2 },
      { min: 2, max: 3 },
      { min: 3, max: 3 },
      { min: 3, max: 4 },
      { min: 4, max: 5 },
      { min: 2, max: 2 },
    ]);
  });
  it("한 범주가 나머지 둘을 합한 것보다 많으면 묶을 수 없음", async () => {
    const { splitProblem } = await import("@/domain/standardCounts");
    expect(splitProblem(area(4, 1, 1))).toContain("지식·이해 내용 요소(4개)");
    expect(splitProblem(area(3, 2, 1))).toBeNull();
  });
  it("묶을 범주 조합: 3개짜리는 세 범주, 2개짜리는 서로 다른 두 범주", async () => {
    const { categorySplit } = await import("@/domain/standardCounts");
    expect(categorySplit(area(2, 2, 2), 2)).toEqual([["knowledge", "process", "values"], ["knowledge", "process", "values"]]);
    expect(categorySplit(area(2, 2, 2), 3)).toEqual([["process", "values"], ["knowledge", "values"], ["knowledge", "process"]]);
    expect(categorySplit(area(2, 2, 1), 2)).toEqual([["knowledge", "process"], ["knowledge", "process", "values"]]);
    expect(categorySplit(area(4, 1, 1), 3)).toBeNull();
    // 범주별로 정확히 내용 요소 수만큼 쓰임
    const sp = categorySplit(area(4, 3, 3), 5)!;
    expect(sp.flat().filter((c) => c === "knowledge")).toHaveLength(4);
    expect(sp.every((cs) => cs.length >= 2 && new Set(cs).size === cs.length)).toBe(true);
  });
  it("추천은 범위 안", async () => {
    const { recommendedStandardCount } = await import("@/domain/standardCounts");
    expect([area(2, 2, 1), area(3, 3, 3), area(4, 3, 3), area(1, 1, 1)].map(recommendedStandardCount)).toEqual([2, 4, 4, 1]);
  });
  it("범위를 벗어난 값은 범위 안으로", async () => {
    const { standardCountsFor } = await import("@/domain/standardCounts");
    expect(standardCountsFor({ areas: [area(2, 2, 1), area(3, 3, 3)], standardCounts: [5, 1] })).toEqual([2, 3]);
  });
  it("정한 개수가 프롬프트에 들어가고, 다르게 오면 알림", () => {
    const d = sampleSubject();
    d.areas[0].knowledge.push("세계 공동체의 구성원");
    d.standardCounts = [3, null];
    const p = standardsPrompt.build(d);
    expect(p).toContain("성취기준 3개 — 묶을 범주: ① 지식·이해 + 가치·태도 (2개)  ② 지식·이해 + 과정·기능 (2개)  ③ 지식·이해 + 과정·기능 (2개)");
    expect(p).toMatch(/- \(2\) 문화 다양성과 존중: 내용 요소 \d+개 → 성취기준 2개/);
    const r = standardsPrompt.parse(wrap({ standards: [{ area: 1, text: "가.", elements: ["세계와 연결된 나의 삶"] }, { area: 2, text: "나.", elements: ["세계의 다양한 문화"] }, { area: 2, text: "다.", elements: ["세계의 다양한 문화"] }] }), d);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.notes.join()).toContain("3개로 정했는데 AI가 1개");
      expect(r.notes.join()).not.toContain("(2) 문화 다양성과 존중:");
    }
  });
});

describe("성취기준 내용 요소 최소 2개와 문장 고치기", () => {
  it("프롬프트에 묶을 범주와 '같은 범주끼리 묶지 않기' 규칙이 들어간다", () => {
    const p = standardsPrompt.build(sampleSubject());
    expect(p).toContain("고르게");
    expect(p).toContain("성취기준 2개 — 묶을 범주: ① 지식·이해 + 과정·기능 (2개)  ② 지식·이해 + 과정·기능 + 가치·태도 (3개)");
    expect(p).toContain("같은 범주의 내용 요소 2개를 함께 묶지 않습니다");
  });
  it("같은 범주끼리 묶은 답은 알림", () => {
    const r = standardsPrompt.parse(wrap({ standards: [{ area: 1, text: "가.", elements: ["세계와 연결된 나의 삶", "세계 문제 해결을 위한 협력의 필요성"] }] }), doc);
    expect(r.ok && r.notes.join()).toContain("같은 범주의 내용 요소를 함께 묶은");
  });
  it("내용 요소가 2개 미만인 성취기준은 알림", () => {
    const r = standardsPrompt.parse(wrap({ standards: [{ area: 1, text: "하나뿐인 성취기준이다.", elements: ["세계와 연결된 나의 삶"] }] }), doc);
    expect(r.ok && r.notes.join()).toContain("2개 미만");
  });
  it("내용 요소를 바꾼 성취기준만 문장 고치기 프롬프트에 들어가고, 답으로 문장만 바뀐다", async () => {
    const { standardNeedsRewrite } = await import("@/domain/types");
    const d = sampleSubject();
    d.standards[0].textFor = [...d.standards[0].elements];
    d.standards[0].elements = ["세계와 연결된 나의 삶", "세계시민 규칙을 실천하려는 의지"];
    expect(standardNeedsRewrite(d.standards[0])).toBe(true);
    expect(standardNeedsRewrite(d.standards[1])).toBe(false);
    const p = reviseStandardsPrompt.build(d);
    expect(p).toContain("[3사지구01-01]");
    expect(p).toContain("바뀐 내용 요소: 세계와 연결된 나의 삶 / 세계시민 규칙을 실천하려는 의지");
    expect(p).not.toContain("지금 문장: 세계 문제 해결을");
    const r = reviseStandardsPrompt.parse(wrap({ standards: [{ code: "[3사지구01-01]", text: "새 문장이다." }, { code: "[9가짜01-01]", text: "x" }] }), d);
    expect(r.ok && r.data).toEqual([{ id: "s1", text: "새 문장이다." }]);
    expect(r.ok && r.notes.join()).toContain("[9가짜01-01]");
  });
});

describe("단원 지도계획 요청 사항", () => {
  it("단원별 차시, 꼭 넣을 내용, 기타 참고사항이 프롬프트에 들어간다", () => {
    const d = sampleSubject();
    d.planRequest = { unitHours: [17, null], mustInclude: ["학교 축제 연계 발표"], notes: "모둠 활동 위주로" };
    const p = planPrompt.build(d);
    expect(p).toContain("- 1단원 (세계시민의 이해 영역): 17차시");
    expect(p).toContain("- 2단원 (문화 다양성과 존중 영역): 12차시");
    expect(p).toContain("- 학교 축제 연계 발표");
    expect(p).toContain("모둠 활동 위주로");
  });
});

describe("단원 지도계획 차시 고치기 요청", () => {
  it("정한 단원별 차시와 다르면 고치기 요청을 만들고, 맞으면 null", () => {
    const d = sampleSubject();
    d.planRequest = { unitHours: [14, 15], mustInclude: [], notes: "" };
    const plan = structuredClone(d.plan.selected!);
    plan.units[0].lessons[0].hours += 2; // 예시안 13·16차시 → 1단원 15차시
    const f = planPrompt.followUp!([plan], d);
    expect(f?.prompt).toContain("1단원 15차시 → 14차시로");
    expect(f?.prompt).toContain("2단원 16차시 → 15차시로");
    expect(f?.prompt).toContain("합계 31차시 → 29차시로");
    d.planRequest = { unitHours: [13, 16], mustInclude: [], notes: "" };
    expect(planPrompt.followUp!([d.plan.selected!], d)).toBeNull();
  });
  it("프롬프트에 unitHours 확인 규칙", () => {
    expect(planPrompt.build(sampleSubject())).toContain("unitHours");
  });
});
