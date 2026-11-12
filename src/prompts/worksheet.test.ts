import { describe, expect, it } from "vitest";
import { Packer } from "docx";
import JSZip from "jszip";
import { seedDesigns } from "@/server/seed";
import type { DesignDoc } from "@/domain/types";
import { blankSheet, emptyWorksheets, lessonSlots, NO_SHEET, normalizeBlock, sheetHeightCm, worksheetIssues } from "@/domain/worksheet";
import { buildWorksheetDocx } from "@/export/worksheetDocx";
import { buildWorksheetPrompt, parseWorksheets, unitSlots, worksheetPrompt } from "./worksheet";

const design = (): DesignDoc => {
  const d = seedDesigns()[0];
  d.worksheets = emptyWorksheets();
  return d;
};
const answer = (o: unknown) => "```json\n" + JSON.stringify(o) + "\n```";

describe("차시별 활동지", () => {
  it("묶인 차시도 차시마다 한 장 (번호가 이어진다)", () => {
    const d = design();
    d.plan.selected!.units[0].lessons[0].hours = 2;
    const slots = lessonSlots(d);
    expect(slots[0]).toMatchObject({ no: 1, part: 1, parts: 2 });
    expect(slots[1]).toMatchObject({ no: 2, part: 2, parts: 2, topic: slots[0].topic });
    expect(slots.at(-1)!.no).toBe(slots.length);
  });

  it("프롬프트: 단원의 차시·선생님 입력·칸 종류가 들어가고 '활동지 없음' 차시는 빠진다", () => {
    const d = design();
    d.worksheets!.settings.material = "「고래는 왜 돌아왔을까?」";
    d.worksheets!.settings.forms = { "1": ["그리기"], "2": [NO_SHEET] };
    const p = buildWorksheetPrompt(d, 0);
    expect(p).toContain("고래는 왜 돌아왔을까?");
    expect(p).toContain("원하는 활동 형태: 그리기");
    expect(p).toContain('"storyboard"');
    expect(p).not.toContain("### 2차시");
    expect(unitSlots(d, 0).map((s) => s.no)).not.toContain(2);
  });

  it("답 읽기: 차시 번호로 맞추고, 한국어 칸 이름도 받고, 모르는 칸은 빼고 알린다", () => {
    const d = design();
    const slots = unitSlots(d, 0);
    const r = parseWorksheets(
      answer({
        sheets: [
          { lesson: slots[1].no, problem: "둘째 시간", lead: "※ 생각해 봅시다.", blocks: [{ type: "원고지", title: "따라 써 봅시다.", count: "6" }, { type: "video", title: "영상" }] },
          { lesson: slots[0].no, problem: "첫 시간", blocks: [{ type: "columns", title: "정리", headers: ["물음", "답"], count: 99 }] },
        ],
      }),
      d,
      0,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.map((s) => s.no)).toEqual([slots[0].no, slots[1].no]);
    expect(r.data[1].lead).toBe("생각해 봅시다.");
    expect(r.data[1].blocks).toEqual([{ type: "grid", title: "따라 써 봅시다.", count: 6 }]);
    expect(r.data[0].blocks[0].count).toBe(10);
    expect(r.notes.join("\n")).toContain("video");
    expect(r.notes.join("\n")).toContain("답에 없어요");
    expect(worksheetPrompt(0).followUp!(r.data, d)?.title).toContain("빠졌어요");
  });

  it("답 읽기 실패", () => {
    const d = design();
    expect(parseWorksheets("모르겠어요", d, 0).ok).toBe(false);
    expect(parseWorksheets(answer({ sheets: [] }), d, 0).ok).toBe(false);
  });

  it("점검: 한 장 넘침·학습주제 바뀜·차시 없음", () => {
    const d = design();
    const s = blankSheet(lessonSlots(d)[0]);
    expect(worksheetIssues(d, s)).toEqual([]);
    s.blocks = [normalizeBlock({ type: "box", title: "그림", size: "large" }), normalizeBlock({ type: "box", title: "그림", size: "large" })];
    expect(sheetHeightCm(s)).toBeGreaterThan(21);
    expect(worksheetIssues(d, s).join()).toContain("A4 한 장");
    d.plan.selected!.units[0].lessons[0].topic = "바뀐 주제";
    expect(worksheetIssues(d, s).join()).toContain("학습주제가 바뀌었어요");
    expect(worksheetIssues(d, { ...s, no: 999 }).join()).toContain("차시가 없어요");
  });

  it(".docx: 첫 장 학습 주제 표 + 차시마다 머리칸·이름 칸·활동 칸", async () => {
    const d = design();
    d.application.schoolName = "광양중동초등학교";
    const slots = lessonSlots(d);
    d.worksheets!.settings.color = "orange";
    d.worksheets!.settings.logo =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    d.worksheets!.sheets = [
      {
        ...blankSheet(slots[0]),
        problem: "표지를 살펴봅시다.",
        lead: "책을 골라 봅시다.",
        blocks: (["lines", "labels", "columns", "grid", "box", "numbered", "list", "storyboard", "selfcheck", "example"] as const).map((type) =>
          normalizeBlock({ type, title: `${type} 칸`, rows: ["제목", "글쓴이"], headers: ["표현", "이유"], items: ["규칙 하나"], text: "예시 글" }),
        ),
      },
      { ...blankSheet(slots[1]), problem: "둘째 시간입니다." },
    ];
    const buf = await Packer.toBuffer(buildWorksheetDocx(d));
    const xml = await (await JSZip.loadAsync(buf)).file("word/document.xml")!.async("string");
    expect(xml).toContain("차시별 학습 주제");
    expect(xml).toContain("표지를 살펴봅시다.");
    expect(xml).toContain("※ 책을 골라 봅시다.");
    expect(xml).toContain(`1/${d.basic.hours}`);
    expect(xml).toContain("이름 (");
    expect(xml).toContain("① 규칙 하나");
    expect(xml).toContain("F4B183");
    expect(xml).toContain("함초롬돋움");
    expect((await JSZip.loadAsync(buf)).file(/media\//).length).toBe(1);
    // 단원 하나만
    const one = await Packer.toBuffer(buildWorksheetDocx(d, [slots[1].no]));
    const xml1 = await (await JSZip.loadAsync(one)).file("word/document.xml")!.async("string");
    expect(xml1).not.toContain("표지를 살펴봅시다.");
    expect(xml1).toContain("둘째 시간입니다.");
  });

  it("AI 답이 흐트러져도 읽기 (시뮬레이션에서 찾은 경우들)", () => {
    const d = design();
    const slots = unitSlots(d, 1);
    const sheet = (no: number, extra: Record<string, unknown> = {}) => ({ lesson: no, problem: "학습문제: 알아봅시다.", blocks: [{ type: "labels", title: "1. 정리해 봅시다.", rows: "알게 된 점, 이름, 반" }, { type: "그림 그리기", title: "② 그려요", size: "크게" }, { type: "체크리스트", title: "평가", rows: ["참여"] }], ...extra });
    // 차시마다 코드 블록 따로 + 주석 + 단원 안에서 1부터 다시 센 번호
    const text = slots.map((s, i) => "```json\n// 활동지\n" + JSON.stringify(sheet(i + 1)) + "\n```").join("\n\n");
    const r = parseWorksheets(text, d, 1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.map((s) => s.no)).toEqual(slots.map((s) => s.no));
    expect(r.notes.join()).toContain("순서대로");
    const s0 = r.data[0];
    expect(s0.problem).toBe("알아봅시다.");
    expect(s0.blocks.map((b) => b.type)).toEqual(["labels", "box", "selfcheck"]);
    expect(s0.blocks[0]).toMatchObject({ title: "정리해 봅시다.", rows: ["알게 된 점"] });
    expect(s0.blocks[1]).toMatchObject({ title: "그려요", size: "large" });
    expect(r.notes.join()).toContain("이름·반·번호");
    // worksheets 키 / 맨 바깥 배열 / '이어서'로 받은 두 조각
    expect(parseWorksheets(answer({ worksheets: slots.map((s) => sheet(s.no)) }), d, 1).ok).toBe(true);
    const arr = parseWorksheets(answer(slots.map((s) => sheet(s.no))), d, 1);
    expect(arr.ok && arr.notes.join()).not.toContain("읽지 못한 조각");
    const whole = JSON.stringify({ sheets: slots.map((s) => sheet(s.no)) }, null, 2);
    const cut = Math.floor(whole.length / 2);
    const two = parseWorksheets("```json\n" + whole.slice(0, cut) + "\n```\n이어서\n```json\n" + whole.slice(cut - 15) + "\n```", d, 1);
    expect(two.ok && two.data.length).toBe(slots.length);
  });

  it("'활동지 없음'으로 바꾼 차시에 활동지가 남아 있으면 알림", () => {
    const d = design();
    const s = blankSheet(lessonSlots(d)[0]);
    d.worksheets!.sheets = [s];
    d.worksheets!.settings.forms = { [String(s.no)]: [NO_SHEET] };
    expect(worksheetIssues(d, s).join()).toContain(NO_SHEET);
  });
});
