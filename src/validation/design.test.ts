import { describe, expect, it } from "vitest";
import { sampleSubject } from "@/domain/sample";
import { codeMap, standardCategories, standardCode } from "@/domain/codes";
import { checklistFor } from "@/domain/checklist";
import {
  checkAssessments,
  checkContentSystem,
  checkCoreIdeas,
  checkIntro,
  checkStandards,
  checkUnitPlan,
  validateDesign,
} from "./design";

import type { Issue } from "./types";

const errors = (issues: Issue[]) => issues.filter((i) => i.level === "error");

describe("예시 문서(지구마을 첫걸음)", () => {
  it("체크리스트 외에는 오류가 없다", () => {
    const doc = sampleSubject();
    expect(errors(validateDesign(doc))).toEqual([]);
  });
  it("체크리스트를 모두 확인하면 경고도 없다", () => {
    const doc = sampleSubject();
    for (const i of checklistFor("subject")) doc.checklist[i.id] = true;
    expect(validateDesign(doc)).toEqual([]);
  });
});

describe("성취기준 코드", () => {
  it("[학년][교과 첫 글자][약어][영역]-[순서] (2027 형식)", () => {
    const doc = sampleSubject();
    const codes = [...codeMap(doc).values()];
    expect(codes).toEqual(["[3사지구01-01]", "[3사지구01-02]", "[3사지구02-01]", "[3사지구02-02]"]);
  });
  it("6학년 사회, 약어 지구촌 → [6사지구촌02-01]", () => {
    const s = [{ id: "a", areaIndex: 1, text: "", elements: [] }];
    expect(standardCode({ grade: 6, subjectGroup: "사회" }, "지구촌", s, s[0])).toBe("[6사지구촌02-01]");
  });
  it("2026학년도까지 운영한 설계는 편성교과 글자 없이 [3지구01-01] (2027 지침부터 교과 글자)", () => {
    const doc = sampleSubject();
    doc.application.startYear = "2026";
    expect([...codeMap(doc).values()][0]).toBe("[3지구01-01]");
    doc.application.startYear = "2027";
    expect([...codeMap(doc).values()][0]).toBe("[3사지구01-01]");
  });
  it("범주는 연결한 내용 요소로 계산한다", () => {
    const doc = sampleSubject();
    expect(standardCategories(doc.areas, doc.standards[1]).sort()).toEqual(["knowledge", "process", "values"]);
  });
});

describe("내용 체계", () => {
  it("지식·이해에 '~알기'를 쓰면 경고", () => {
    const issues = checkContentSystem([{ name: "평화", knowledge: ["평화의 중요성 알기"], process: ["탐구하기"], values: ["존중"] }]);
    expect(issues.some((i) => i.message.includes("명사형"))).toBe(true);
  });
  it("과정·기능이 '~하기'로 끝나지 않으면 경고", () => {
    const issues = checkContentSystem([{ name: "평화", knowledge: ["평화의 중요성"], process: ["평화 활동 참여"], values: ["존중"] }]);
    expect(issues.some((i) => i.field.includes("과정·기능"))).toBe(true);
  });
  it("범주가 비면 오류, 영역 1개면 경고", () => {
    const issues = checkContentSystem([{ name: "평화", knowledge: [], process: ["탐구하기"], values: ["존중"] }]);
    expect(errors(issues)).toHaveLength(1);
    expect(issues.some((i) => i.field === "영역 수")).toBe(true);
  });
});

describe("핵심아이디어", () => {
  it("당위 표현은 경고", () => {
    expect(checkCoreIdeas(["우리는 환경을 보호해야 한다."], 1).some((i) => i.message.includes("당위"))).toBe(true);
  });
  it("영역 수와 다르면 경고", () => {
    expect(checkCoreIdeas(["문화는 다양하다."], 2).some((i) => i.field === "핵심아이디어 수")).toBe(true);
  });
});

describe("성취기준", () => {
  it("약어가 2~3자가 아니면 오류", () => {
    const doc = { ...sampleSubject(), abbrev: "지구마을첫" };
    expect(errors(checkStandards(doc)).some((i) => i.field === "성취기준 코드 약어")).toBe(true);
  });
  it("같은 범주의 내용 요소를 함께 묶으면 확인 필요(권장)", () => {
    const doc = sampleSubject();
    doc.standards[0].elements = ["세계와 연결된 나의 삶", "세계 문제 해결을 위한 협력의 필요성"];
    doc.standards[1].elements = ["세계 어린이의 생활 탐구하기", "세계시민 규칙 정하기", "세계시민 규칙을 실천하려는 의지"];
    const issues = checkStandards(doc).filter((i) => i.level === "warning");
    expect(issues.some((i) => i.field === "[3사지구01-01]" && i.message.includes("같은 범주(지식·이해)"))).toBe(true);
    expect(issues.some((i) => i.field === "[3사지구01-02]" && i.message.includes("같은 범주(과정·기능)"))).toBe(true);
  });
  it("한 범주의 내용 요소가 나머지 두 범주 합보다 많으면 내용 체계 오류", () => {
    const doc = sampleSubject();
    doc.areas[1].knowledge.push("문화의 뜻", "문화의 종류", "문화의 변화");
    expect(errors(checkContentSystem(doc.areas)).some((i) => i.message.includes("서로 다른 범주끼리 묶을 수 없습니다"))).toBe(true);
    expect(errors(checkContentSystem(sampleSubject().areas))).toHaveLength(0);
  });
  it("한 내용 요소를 두 성취기준에 넣으면 오류", () => {
    const doc = sampleSubject();
    doc.standards[1].elements.push("세계와 연결된 나의 삶");
    expect(errors(checkStandards(doc)).some((i) => i.message.includes("겹쳐 들어가"))).toBe(true);
  });
  it("어느 성취기준에도 안 쓴 내용 요소는 경고, 내용 요소 1개는 오류", () => {
    const doc = sampleSubject();
    doc.standards[0].elements = ["세계와 연결된 나의 삶"];
    const issues = checkStandards(doc);
    expect(issues.some((i) => i.message.includes("연결되지 않은 내용 요소") && i.message.includes("세계 어린이의 생활 탐구하기"))).toBe(true);
    expect(errors(issues).some((i) => i.message.includes("1개뿐"))).toBe(true);
  });
  it("문장을 쓴 뒤 내용 요소가 바뀌면 확인 필요", () => {
    const doc = sampleSubject();
    doc.standards[2].textFor = [...doc.standards[2].elements];
    doc.standards[2].elements = ["세계의 다양한 문화", "다양한 문화 존중 모습 표현하기"];
    doc.standards[3].elements = ["생활 속 문화 존중 사례 조사하기", "다양한 문화를 존중하는 태도"];
    expect(checkStandards(doc).some((i) => i.field === "[3사지구02-01]" && i.message.includes("바뀌었습니다"))).toBe(true);
  });
  it("'~할 수 있다.'로 끝나면 오류, '~한다.'는 통과", () => {
    const doc = sampleSubject();
    doc.standards[0].text = "세계와 연결된 나의 삶을 이해하고, 세계 어린이의 생활을 탐구할 수 있다.";
    expect(errors(checkStandards(doc)).some((i) => i.message.includes("'~할 수 있다.'"))).toBe(true);
    doc.standards[0].text = "세계와 연결된 나의 삶을 이해하고, 세계 어린이의 생활을 탐구한다.";
    expect(checkStandards(doc).some((i) => i.message.includes("'~할 수 있다.'"))).toBe(false);
  });
  it("내용 요소가 없으면 오류", () => {
    const doc = sampleSubject();
    doc.standards[0].elements = [];
    expect(errors(checkStandards(doc))).toHaveLength(1);
  });
});

describe("목표", () => {
  it("세부 목표 3개가 모두 있어야 함", () => {
    const doc = sampleSubject();
    doc.intro.detailGoals = ["가", "", "다"];
    expect(errors(checkIntro(doc)).map((i) => i.field)).toEqual(["세부 목표(과정·기능)"]);
  });
});

describe("단원 지도계획·평가 계획", () => {
  it("배치되지 않은 성취기준은 오류", () => {
    const doc = sampleSubject();
    doc.plan.selected!.units[1].standardIds = ["s3"];
    expect(errors(checkUnitPlan(doc)).some((i) => i.field === "[3사지구02-02]")).toBe(true);
  });
  it("과목은 모든 성취기준에 성취수준이 있어야 함", () => {
    const doc = sampleSubject();
    doc.assessments[1].standardIds = ["s3"];
    expect(errors(checkAssessments(doc)).some((i) => i.field === "[3사지구02-02]")).toBe(true);
  });
  it("활동은 같은 경우 경고", () => {
    const doc = sampleSubject();
    doc.basic.type = "activity";
    doc.assessments[1].standardIds = ["s3"];
    expect(errors(checkAssessments(doc))).toEqual([]);
  });
  it("예시 문서의 단원 지도계획은 오류 없음", () => {
    expect(errors(checkUnitPlan(sampleSubject()))).toEqual([]);
  });
  it("전단계 활동이 빠지면 오류", () => {
    const doc = sampleSubject();
    for (const u of doc.plan.selected!.units) for (const l of u.lessons) l.inputActivities = l.inputActivities.filter((a) => a !== "문화 존중 역할극");
    expect(errors(checkUnitPlan(doc)).some((i) => i.field === "전단계 활동" && i.message.includes("'문화 존중 역할극'"))).toBe(true);
  });
  it("과정중심평가는 성취기준마다 정확히 1개", () => {
    const doc = sampleSubject();
    const lessons = doc.plan.selected!.units[0].lessons;
    lessons[0].assessFor = "s1";
    lessons[0].assessment = "한 번 더 평가";
    lessons[6].assessFor = "";
    lessons[6].assessment = "";
    const issues = errors(checkUnitPlan(doc));
    expect(issues.some((i) => i.field === "[3사지구01-01]" && i.message.includes("2개"))).toBe(true);
    expect(issues.some((i) => i.field === "[3사지구01-02]" && i.message.includes("과정중심평가가 없습니다"))).toBe(true);
  });
  it("평가 성취기준을 정하지 않거나, 다른 단원의 성취기준을 평가하면 오류", () => {
    const doc = sampleSubject();
    const lessons = doc.plan.selected!.units[0].lessons;
    lessons[0].assessment = "평가 내용만 있음";
    lessons[2].assessFor = "s3";
    const issues = errors(checkUnitPlan(doc));
    expect(issues.some((i) => i.message.includes("어느 성취기준을 평가하는지"))).toBe(true);
    expect(issues.some((i) => i.message.includes("이 단원에 배치하지 않은 성취기준"))).toBe(true);
  });
  it("같은 단원의 성취기준은 과정중심평가 하나로 묶어 평가할 수 있다", () => {
    const doc = sampleSubject();
    const lessons = doc.plan.selected!.units[0].lessons;
    lessons[2].assessFor = "";
    lessons[2].assessment = "";
    lessons[6].assessFor = "s1";
    lessons[6].assessWith = ["s2"];
    expect(errors(checkUnitPlan(doc))).toEqual([]);
    expect(errors(checkAssessments(doc))).toEqual([]);
  });
  it("다른 영역(단원)의 성취기준과는 묶을 수 없다", () => {
    const doc = sampleSubject();
    doc.plan.selected!.units[0].lessons[6].assessWith = ["s3"];
    const issues = errors(checkUnitPlan(doc));
    expect(issues.some((i) => i.message.includes("같은 영역(단원)의 성취기준끼리만"))).toBe(true);
    expect(issues.some((i) => i.field === "[3사지구02-01]" && i.message.includes("2개"))).toBe(true);
  });
  it("평가 내용이 단원 지도계획에 없으면 오류", () => {
    const doc = sampleSubject();
    for (const l of doc.plan.selected!.units[1].lessons) l.assessment = "";
    expect(errors(checkAssessments(doc)).some((i) => i.message.includes("단원 지도계획에 들어 있지 않습니다"))).toBe(true);
  });
});

describe("확인 필요 점검 무시하기", () => {
  it("무시한 권장 점검은 빠지고, 내용이 바뀌어 문장이 달라지면 다시 나온다. 오류는 무시할 수 없다", async () => {
    const { sampleSubject } = await import("@/domain/sample");
    const { issueKey, validateDesign } = await import("./design");
    const doc = sampleSubject();
    doc.areas = doc.areas.slice(0, 1);
    doc.standards = doc.standards.filter((s) => s.areaIndex === 0);
    const w = validateDesign(doc).find((i) => i.field === "영역 수")!;
    expect(w.level).toBe("warning");
    doc.dismissed = [issueKey(w)];
    expect(validateDesign(doc).some((i) => i.field === "영역 수")).toBe(false);
    doc.areas = [...doc.areas, ...Array.from({ length: 3 }, () => ({ ...doc.areas[0], name: "새 영역" }))];
    expect(validateDesign(doc).some((i) => i.field === "영역 수")).toBe(true);
    const err = validateDesign(doc).find((i) => i.level === "error")!;
    doc.dismissed.push(issueKey(err));
    expect(validateDesign(doc).some((i) => issueKey(i) === issueKey(err))).toBe(true);
  });
});
