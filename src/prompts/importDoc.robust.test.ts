import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import { seedDesigns } from "@/server/seed";
import { codeMap } from "@/domain/codes";
import { extractJsonBlocks, isGuideLine, joinFragments, mergeLevelRows, parseImport, stripJsonComments, stripUnitNo } from "./importDoc";

/**
 * 가상 시뮬레이션(2026-11-11)에서 찾은 AI 답의 흔한 실수들. 앱이 너그럽게 읽거나, 정확한 이유로 막아야 한다.
 * (11개 문서 × 32가지 경우를 돌린 시뮬레이션 중 대표를 회귀 테스트로 남김)
 */
const PDF_TEXT = readFileSync(new URL("./__fixtures__/jigu-first-step.pdf.txt", import.meta.url), "utf8");
const seed = seedDesigns()[0];
type J = any; // eslint-disable-line @typescript-eslint/no-explicit-any

function answers(): [J, J] {
  const codes = codeMap({ ...seed, application: { ...seed.application, startYear: "2026" } });
  return [
    {
      part: 1, designCount: 1, type: "활동", name: seed.basic.name, grade: 3, semester: 2, hours: 29,
      subjectGroup: "사회", openingType: seed.basic.openingType, operationMode: seed.basic.operationMode, schoolYear: "2026",
      topic: seed.input.topic, abbrev: seed.abbrev, rationale: seed.intro.rationale, overallGoal: seed.intro.overallGoal,
      detailGoals: seed.intro.detailGoals, coreIdeas: seed.coreIdeas, areas: seed.areas,
      standards: seed.standards.map((s) => ({ code: codes.get(s.id), area: s.areaIndex + 1, text: s.text, elements: s.elements })),
      teaching: seed.teaching, application: {},
    },
    {
      part: 2,
      units: seed.plan.selected!.units.map((u) => ({
        unitName: u.unitName,
        lessons: u.lessons.map((l) => ({ hours: l.hours, topic: l.topic, goal: l.goal, activities: l.activities, assessment: l.assessment, assessStandards: [l.assessFor, ...(l.assessWith ?? [])].filter(Boolean).map((id) => codes.get(id)), note: l.note })),
      })),
      assessments: seed.assessments.map((a) => ({ month: a.month, standards: a.standardIds.map((id) => codes.get(id)), focus: a.focus, levels: a.levels, methods: a.methods })),
    },
  ];
}
const fence = (o: unknown) => "```json\n" + JSON.stringify(o, null, 2) + "\n```";
const read = (t1: string, t2: string) => parseImport(t1, t2, { schoolYear: "2026", schoolName: "", sourceText: PDF_TEXT });
const lessons = (p2: J) => p2.units.flatMap((u: J) => u.lessons);

describe("AI 답의 흔한 실수 (가상 시뮬레이션 회귀)", () => {
  it("정상 답은 문서와 같다고 보고 그대로 읽는다", () => {
    const [a, b] = answers();
    const r = read(fence(a), fence(b));
    expect(r.ok && r.doc.plan.selected!.units.flatMap((u) => u.lessons).length).toBe(lessons(b).length);
  });

  it("숫자를 글자로, 코드 띄어쓰기, 쉼표로 이은 코드·평가 방법·내용 요소", () => {
    const [a, b] = answers();
    a.grade = "3학년"; a.semester = "2학기"; a.hours = "29시간";
    a.standards[0].elements = a.standards[0].elements.join(", ");
    for (const x of b.assessments) { x.standards = x.standards.join(", ").replace("[", "[ "); x.methods = x.methods.join(", "); }
    const r = read(fence(a), fence(b));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.missing).toEqual([]);
    expect(r.doc.standards[0].elements).toEqual(seed.standards[0].elements);
    expect(r.doc.assessments.map((x) => x.standardIds.length)).toEqual(seed.assessments.map((x) => x.standardIds.length));
    expect(r.doc.assessments[0].methods).toEqual(seed.assessments[0].methods);
    expect(r.notes.join()).not.toContain("연결하지 못했어요");
  });

  it("성취수준을 배열·상중하 키로, A·B·C를 세 줄로 나눠도 하나로", () => {
    const [a, b] = answers();
    b.assessments[0].levels = [b.assessments[0].levels.A, b.assessments[0].levels.B, b.assessments[0].levels.C];
    const L = b.assessments[1].levels;
    b.assessments[1].levels = { 상: L.A, 중: L.B, 하: L.C };
    if (b.assessments[2]) b.assessments[2].levels = { "◎": L.A, "○": L.B, "△": L.C };
    const r = read(fence(a), fence(b));
    expect(r.ok && r.doc.assessments.every((x) => x.levels.A && x.levels.B && x.levels.C)).toBe(true);
    expect(mergeLevelRows([
      { month: "9월", standardIds: ["s1"], focus: "f", levels: { A: "a", B: "", C: "" }, methods: ["관찰"] },
      { month: "", standardIds: [], focus: "", levels: { A: "", B: "b", C: "" }, methods: [] },
      { month: "", standardIds: [], focus: "", levels: { A: "", B: "", C: "c" }, methods: [] },
      { month: "10월", standardIds: ["s2"], focus: "g", levels: { A: "x", B: "y", C: "z" }, methods: [] },
    ]).map((x) => Object.values(x.levels).join())).toEqual(["a,b,c", "x,y,z"]);
  });

  it("· 목표 줄 섞임, 목표 앞 기호, 단원 번호 겹침, hours 대신 '2~3/29'", () => {
    const [a, b] = answers();
    let n = 1;
    for (const l of lessons(b)) {
      if (l.goal) { l.activities = ["·" + l.goal, ...l.activities.map((x: string) => "- " + x)]; l.goal = ""; }
      l.lesson = l.hours > 1 ? `${n}~${n + l.hours - 1}/29` : `${n}/29`;
      n += l.hours;
      delete l.hours;
    }
    b.units[0].unitName = "1단원 1단원 " + b.units[0].unitName;
    const r = read(fence(a), fence(b));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const got = r.doc.plan.selected!.units.flatMap((u) => u.lessons);
    expect(got.reduce((s, l) => s + l.hours, 0)).toBe(seed.plan.selected!.units.flatMap((u) => u.lessons).reduce((s, l) => s + l.hours, 0));
    expect(got.some((l) => l.activities.some((x) => /^[·-]/.test(x)))).toBe(false);
    expect(r.doc.plan.selected!.units[0].unitName).toBe(seed.plan.selected!.units[0].unitName);
    expect(stripUnitNo("1단원 1단원 먼저 읽어요")).toBe("먼저 읽어요");
  });

  it("'이어서'로 받은 조각·되풀이·주석·보이지 않는 글자·작성 안내문", () => {
    const [a, b] = answers();
    const t = JSON.stringify(b, null, 2);
    const cut = Math.floor(t.length * 0.6);
    a.name = a.name.replace(" ", " ​");
    a.rationale = "1. 과목(활동)이 가지는 고유의 특성에 대해 개괄적으로 소개한다.\n" + a.rationale;
    const p1 = fence(a).replace('"part": 1,', '"part": 1, // 1부');
    const p2 = "```json\n" + t.slice(0, cut) + "\n```\n이어서:\n```json\n" + t.slice(cut - 30) + "\n```";
    const r = read(p1, p2);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.doc.basic.name).toBe(seed.basic.name);
    expect(r.doc.intro.rationale).not.toContain("개괄적으로");
    expect(r.notes.join()).toContain("작성 안내문");
    // 문장 중간에서 끊긴 뒤 이어 붙이기 (줄바꿈 없이), 8자 이상 되풀이한 부분은 한 번만
    expect(joinFragments('{"a": "세계와 연결된\n', ' 나의 삶"}')).toBe('{"a": "세계와 연결된 나의 삶"}');
    expect(joinFragments('{"a": "세계와 연결된 나의 삶을 이해하고\n', '나의 삶을 이해하고 탐구한다"}')).toBe('{"a": "세계와 연결된 나의 삶을 이해하고 탐구한다"}');
    expect(stripJsonComments('{"u": "http://x", // 설명\n "b": 1 /* 끝 */}')).toBe('{"u": "http://x", \n "b": 1 }');
    expect(isGuideLine("2. 총괄 목표와 세부 목표로 구분하여 제시한다.")).toBe(true);
    expect(isGuideLine("(1) 놀이 방법을 창의적으로 바꾸어 제시한다.")).toBe(false);
  });

  it("막아야 하는 답: 끊긴 답(이어서 없음), 과목(활동) 섞임은 묻기, 내용 바꿔 쓰기", () => {
    const [a, b] = answers();
    const cut = read(fence(a), "```json\n" + JSON.stringify(b).slice(0, 300));
    expect(cut.ok === false && cut.error).toContain("끊긴 것 같아요");
    expect(extractJsonBlocks("```json\n{\"a\":").broken).toBe(true);

    const both = answers();
    both[0].type = "학교자율시간 과목(활동)";
    const r = read(fence(both[0]), fence(both[1]));
    expect(r.ok && r.missing.map((m) => m.key)).toContain("type");

    const rw = answers();
    rw[0].standards.forEach((x: J, i: number) => (x.text = `학생들은 주제에 대해 탐구하고 배운 내용을 생활 속에서 실천하는 태도를 기른다 ${i}.`));
    rw[0].areas.forEach((x: J, i: number) => (x.name = `새 영역 ${i}`));
    lessons(rw[1]).forEach((l: J, i: number) => (l.topic = `주제 탐구 활동 ${i}차시 하기`));
    rw[0].overallGoal = "창의적으로 생각하고 협력하는 어린이를 기른다.";
    rw[0].rationale = "이 활동은 미래 사회에 필요한 역량을 기르기 위해 만들었다.";
    const w = read(fence(rw[0]), fence(rw[1]));
    expect(w.ok === false && w.error).toContain("찾을 수 있는 것이");
  });
});
