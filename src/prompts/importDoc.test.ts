import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import { seedDesigns } from "@/server/seed";
import { codeMap } from "@/domain/codes";
import type { DesignDoc } from "@/domain/types";
import { buildImportPrompt, checkAgainstSource, codeDiffNote, stripUnitNo, extractAllJson, guessAbbrev, IMPORT_PART2_PROMPT, parseImport, uniqueName } from "./importDoc";

/** 예시안 PDF(지구마을 첫걸음)에서 앱이 실제로 뽑은 글자 */
const PDF_TEXT = readFileSync(new URL("./__fixtures__/jigu-first-step.pdf.txt", import.meta.url), "utf8");

/** 앱 설계를 'AI가 문서를 옮겨 적은 답' 모양으로 (되돌려 읽으면 같아야 함) */
function asAnswers(doc: DesignDoc): [string, string] {
  const codes = codeMap(doc);
  const p1 = {
    part: 1,
    designCount: 1,
    type: doc.basic.type === "subject" ? "과목" : "활동",
    name: doc.basic.name,
    grade: `${doc.basic.grade}학년`,
    semester: String(doc.basic.semester),
    hours: doc.basic.hours,
    subjectGroup: doc.basic.subjectGroup,
    openingType: doc.basic.openingType.replace(/ /g, ""),
    operationMode: doc.basic.operationMode,
    schoolYear: doc.application.startYear,
    topic: doc.input.topic,
    abbrev: doc.abbrev,
    rationale: doc.intro.rationale,
    overallGoal: doc.intro.overallGoal,
    detailGoals: doc.intro.detailGoals.map((g, i) => `(${i + 1}) ${g}`),
    coreIdeas: doc.coreIdeas,
    areas: doc.areas,
    standards: doc.standards.map((s) => ({ code: codes.get(s.id), area: s.areaIndex + 1, text: s.text, elements: s.elements })),
    teaching: doc.teaching,
    application: doc.application,
  };
  const p2 = {
    part: 2,
    units: doc.plan.selected!.units.map((u) => ({
      unitName: u.unitName,
      lessons: u.lessons.map((l) => ({
        hours: l.hours,
        topic: l.topic,
        goal: l.goal,
        activities: l.activities,
        assessment: l.assessment,
        assessStandards: [l.assessFor, ...(l.assessWith ?? [])].filter(Boolean).map((id) => codes.get(id)),
        note: l.note,
      })),
    })),
    assessments: doc.assessments.map((a) => ({ ...a, standards: a.standardIds.map((id) => codes.get(id)) })),
  };
  return [`네, 1부입니다.\n\`\`\`json\n${JSON.stringify(p1, null, 2)}\n\`\`\``, `\`\`\`json\n${JSON.stringify(p2)},\n\`\`\``];
}

describe("기존 문서 가져오기", () => {
  const seed = seedDesigns()[0];

  it("문서를 옮긴 답을 읽으면 원래 설계와 같은 내용이 된다", () => {
    const [a1, a2] = asAnswers(seed);
    const r = parseImport(a1, a2, { schoolYear: seed.application.startYear, schoolName: "가나초등학교", sourceText: PDF_TEXT });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const d = r.doc;
    expect(d.basic).toEqual(seed.basic);
    expect(d.areas).toEqual(seed.areas);
    expect(d.coreIdeas).toEqual(seed.coreIdeas);
    expect(d.standards.map((s) => [s.areaIndex, s.text, s.elements])).toEqual(seed.standards.map((s) => [s.areaIndex, s.text, s.elements]));
    expect(d.intro).toEqual(seed.intro);
    expect(d.plan.selected!.units.map((u) => u.lessons.map((l) => [l.hours, l.topic, l.activities, l.assessment]))).toEqual(
      seed.plan.selected!.units.map((u) => u.lessons.map((l) => [l.hours, l.topic, l.activities, l.assessment])),
    );
    expect(d.assessments.map((a) => a.levels)).toEqual(seed.assessments.map((a) => a.levels));
    expect(d.assessments[0].standardIds.length).toBe(seed.assessments[0].standardIds.length);
    expect(d.application.schoolName).toBe("가나초등학교");
    expect(r.notes).toEqual([]);
    expect(r.missing).toEqual([]);
  });

  it("문서와 다른 답(예시 베끼기·다른 설계)은 막는다", () => {
    const [a1, a2] = asAnswers(seed);
    const other = "학교자율시간 활동 「나도 그림책 작가」 광양중동초등학교 3학년 2학기 그림책의 구성요소와 제작 과정을 이해한다.";
    const r = parseImport(a1, a2, { schoolYear: "2026", schoolName: "", sourceText: other });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("「지구마을 첫걸음」이(가) 올린 문서에 없어요");
    // 이름만 맞고 내용은 다른 경우
    expect(checkAgainstSource(seed, `${other} 지구마을 첫걸음`)).toContain("찾을 수 있는 것이");
    // 문서 글자를 주지 않으면(파일 첨부 방식) 확인하지 못했다고 알림
    const r2 = parseImport(a1, a2, { schoolYear: "2026", schoolName: "" });
    expect(r2.ok && r2.notes.join()).toContain("확인하지 못했어요");
  });

  it("프롬프트 형식 예시에는 실제 설계 내용이 없다 (AI가 베끼지 않게)", () => {
    const p = buildImportPrompt("문서") + IMPORT_PART2_PROMPT;
    for (const real of ["지구마을", "세계시민", "세계와 연결된 나", "\"2026\""]) expect(p).not.toContain(real);
    expect(p).toContain("자리 표시");
  });

  it("1부·2부를 한 칸에 함께 붙여 넣어도 읽는다", () => {
    const [a1, a2] = asAnswers(seed);
    expect(parseImport(`${a1}\n\n${a2}`, "", { schoolYear: "2026", schoolName: "" }).ok).toBe(true);
  });

  it("2부가 없으면 2부를 요청하라고 알린다", () => {
    const [a1] = asAnswers(seed);
    const r = parseImport(a1, "", { schoolYear: "2026", schoolName: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("2부");
  });

  it("설계가 여러 개인 파일은 거절한다", () => {
    const r = parseImport('```json\n{"part":1,"designCount":4}\n```', "", { schoolYear: "2026", schoolName: "" });
    expect(r).toEqual({ ok: false, error: "이 파일에는 설계가 4개 들어 있어요.", multiple: 4 });
  });

  it("선택지에 없는 값·다른 학년도·없는 코드는 바꾸고 알린다 (내용은 그대로)", () => {
    const [a1, a2] = asAnswers(seed);
    const bad1 = a1.replace(`"subjectGroup": "사회"`, `"subjectGroup": "창체"`).replace(`"schoolYear": "${seed.application.startYear}"`, `"schoolYear": "2025"`);
    const bad2 = a2.replace(/"assessStandards":\["[^"]+"/, `"assessStandards":["[9없음01-01]"`);
    const r = parseImport(bad1, bad2, { schoolYear: "2027", schoolName: "" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // 선택지에 없는 편성 교과는 팝업에서 고르도록 missing으로 (임시로 기본값)
    expect(r.missing).toEqual([{ key: "subjectGroup", raw: "창체" }]);
    expect(r.notes.join("\n")).not.toContain("창체");
    expect(r.notes.join("\n")).toContain("2025학년도");
    expect(r.notes.join("\n")).toContain("[9없음01-01]");
    // 2027학년도는 코드에 교과 글자가 들어가 원본 코드와 다를 수 있음 → 알림
    expect(r.doc.application.startYear).toBe("2027");
  });

  it("문서에서 못 찾은 기본 정보는 모두 missing으로, 코드 알림은 편성 교과를 고른 뒤 다시 계산", () => {
    const [a1, a2] = asAnswers(seed);
    const p1 = JSON.parse(a1.slice(a1.indexOf("{"), a1.lastIndexOf("}") + 1));
    for (const k of ["type", "grade", "semester", "subjectGroup", "openingType", "operationMode"]) p1[k] = "";
    p1.hours = 99;
    const r = parseImport("```json\n" + JSON.stringify(p1) + "\n```", a2, { schoolYear: "2027", schoolName: "" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.missing.map((m) => m.key).sort()).toEqual(["grade", "hours", "openingType", "operationMode", "semester", "subjectGroup", "type"]);
    expect(r.missing.find((m) => m.key === "hours")!.raw).toContain("99시간");
    const doc = structuredClone(r.doc);
    doc.basic.grade = 3;
    doc.basic.subjectGroup = "사회";
    // 원본은 2026학년도 코드(교과 글자 없음), 2027학년도로 가져오면 교과 글자가 붙음
    expect(codeDiffNote(doc, r.originalCodes)).toContain("앱 [3사지구01-01]");
    doc.basic.subjectGroup = "국어";
    expect(codeDiffNote(doc, r.originalCodes)).toContain("앱 [3국지구01-01]");
  });

  it("원본 모양 맞추기: 단원 번호 떼기, '·~봅시다.' 첫 줄은 학습 목표로, 활동 문서의 교수·학습도 보관", () => {
    const [a1] = asAnswers(seed);
    const p1 = JSON.parse(a1.slice(a1.indexOf("{"), a1.lastIndexOf("}") + 1));
    p1.teaching = { teachingDirection: ["(1) 여건을 조성한다."], teachingMethods: [], assessDirection: [], assessMethods: [] };
    const p2 = {
      part: 2,
      units: [
        {
          unitName: "1단원 먼저 읽어요",
          lessons: [
            { hours: 1, topic: "책 읽기", goal: "", activities: ["·「고래는 왜 돌아왔을까?」를 읽어봅시다.", "- 표지 그림 살펴보기", "- 내용 예상하기"], assessment: "", note: "" },
            { hours: 1, topic: "책 읽기2", goal: "", activities: ["- 표지 살펴보기"], assessment: "", note: "" },
          ],
        },
      ],
      assessments: [],
    };
    const r = parseImport("```json\n" + JSON.stringify(p1) + "\n```", "```json\n" + JSON.stringify(p2) + "\n```", { schoolYear: "2026", schoolName: "" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const u = r.doc.plan.selected!.units[0];
    expect(u.unitName).toBe("먼저 읽어요");
    expect(u.lessons[0].goal).toBe("「고래는 왜 돌아왔을까?」를 읽어봅시다.");
    expect(u.lessons[0].activities).toEqual(["표지 그림 살펴보기", "내용 예상하기"]);
    expect(u.lessons[1].goal).toBe("");
    expect(r.doc.basic.type).toBe("activity");
    expect(r.doc.teaching.teachingDirection.length).toBe(1);
    expect(["2. 작가님과 함께 해요", "(3) 그림책", "Ⅱ. 만들기", "단원 없음"].map(stripUnitNo)).toEqual(["작가님과 함께 해요", "그림책", "만들기", "단원 없음"]);
  });

  it("JSON이 없으면 오류", () => {
    expect(parseImport("죄송합니다", "", { schoolYear: "2026", schoolName: "" }).ok).toBe(false);
    expect(extractAllJson("```json\n{\"a\":1,}\n```\n```json\n{\"b\":2}\n```")).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it("프롬프트: 문서 글자가 있으면 넣고, 없으면 파일 첨부를 안내", () => {
    expect(buildImportPrompt("성취기준 [3사지구01-01]")).toContain("<<<문서 시작>>>");
    expect(buildImportPrompt("")).toContain("첨부한 파일");
    expect(IMPORT_PART2_PROMPT).toContain("2부");
  });

  it("약어 짐작과 이름 중복", () => {
    expect(guessAbbrev("[3사지구01-01]", "사회")).toBe("지구");
    expect(guessAbbrev("[6디탐02-03]", "실과")).toBe("디탐");
    expect(uniqueName("지구마을", ["지구 마을", "지구마을 (2)"])).toBe("지구마을 (3)");
    expect(uniqueName("새 활동", ["다른 활동"])).toBe("새 활동");
    expect(uniqueName("가".repeat(40), ["가".repeat(40)])).toHaveLength(40);
  });
});
