import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { initialCheck, semesterLabelWithYear, viewYears } from "@/domain/hoursView";
import { autoReduce, checkAllocation, defaultAllocation, type AllocationInput, type SemesterIndex } from "@/validation/allocation";
import { buildAllocationXlsx } from "@/export/allocationXlsx";
import { planTemplateApply, readAllocationTemplate, TEMPLATE_INFO_SHEET, type TemplateMeta } from "./allocationTemplate";

/**
 * '엑셀로 편성표 입력하기' 시뮬레이션: 선생님이 양식에서 할 법한 일들을 엑셀 파일로 직접 만들어 올려 본다.
 */
const GRADE = 3;
const YEAR = 2027;
const label = (s: number) => semesterLabelWithYear(GRADE, YEAR, s as SemesterIndex);
const view = { grade: GRADE, schoolYear: YEAR };

function screen(): AllocationInput {
  const c = initialCheck(GRADE, YEAR, [{ id: "d1", name: "우리 마을", grade: 3, semester: 1, hours: 29, subjectGroup: "사회", schoolYear: "2027" }]);
  c.input.courses.push({ name: "4학년 생태", subjectKey: "과학", semester: 2, hours: 29 });
  return c.input;
}
const template = (a: AllocationInput, grade = GRADE, schoolYear = YEAR) =>
  buildAllocationXlsx(a, { years: viewYears(grade as 3, schoolYear), grade, schoolYear }, { template: true });

/** 양식을 열어 고친 뒤 다시 저장 (선생님이 엑셀에서 하는 일) */
async function edit(buf: ArrayBuffer, fn: (ws: ExcelJS.Worksheet, meta: TemplateMeta, wb: ExcelJS.Workbook) => void): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const meta = JSON.parse(String(wb.getWorksheet(TEMPLATE_INFO_SHEET)!.getCell(2, 1).value)) as TemplateMeta;
  fn(wb.worksheets[0], meta, wb);
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
async function upload(buf: ArrayBuffer, current: AllocationInput, v = view) {
  const r = await readAllocationTemplate(buf);
  if (!r.ok) return { ok: false as const, error: r.error, problems: [] as string[] };
  return planTemplateApply(current, v, r.read, label);
}

describe("엑셀 입력 양식 (시뮬레이션)", () => {
  it("양식: 노란 칸만 풀려 있고 학교자율시간 줄은 잠김, 숨긴 앱정보 시트", async () => {
    const a = screen();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await template(a));
    const ws = wb.worksheets[0];
    const info = wb.getWorksheet(TEMPLATE_INFO_SHEET)!;
    expect(info.state).toBe("veryHidden");
    const meta = JSON.parse(String(info.getCell(2, 1).value)) as TemplateMeta;
    expect(meta.courses).toEqual(["우리 마을|사회|0|29", "4학년 생태|과학|2|29"]);
    const r = meta.rows.subjects["국어"];
    expect(ws.getCell(r, meta.cols[0]).protection?.locked).toBe(false);
    expect(ws.getCell(r, 4).protection?.locked).not.toBe(false); // 기준시수는 잠김
    // 학교자율시간(사회 아래 '우리 마을') 줄은 잠김
    const courseRow = meta.rows.subjects["사회"] + 1;
    expect(String(ws.getCell(courseRow, 3).value)).toBe("우리 마을");
    expect(ws.getCell(courseRow, meta.cols[1]).protection?.locked).not.toBe(false);
    expect(String(ws.getCell(3, 1).value)).toContain("입력 양식");
  });

  it("그대로 올리면 바뀌는 칸 없음, 고쳐 올리면 교과·창체 모두 반영되고 점검 이상없음", async () => {
    const a = screen();
    const buf = await template(a);
    const same = await upload(buf, a);
    expect(same.ok && same.changes.length).toBe(0);
    expect(same.ok && same.notes.join()).toContain("모두 같아요");

    const target = autoReduce(a); // 학교에서 맞춘 값이라고 치고 엑셀에 입력
    const filled = await edit(buf, (ws, m) => {
      for (const [k, row] of Object.entries(m.rows.subjects)) m.cols.forEach((c, s) => (ws.getCell(row, c).value = target.subjectHours[k][s]));
      const parts = target.creativeParts!;
      for (const [k, row] of Object.entries(m.rows.creative)) m.cols.forEach((c, s) => (ws.getCell(row!, c).value = parts[k as "self"][s]));
    });
    const r = await upload(filled, a);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.next.subjectHours).toEqual(target.subjectHours);
    expect(r.next.creativeHours).toEqual(target.creativeHours);
    expect(r.next.courses).toEqual(a.courses); // ①은 그대로
    expect(r.changes.length).toBeGreaterThan(0);
    expect(checkAllocation(r.next, viewYears(3, YEAR)).issues.filter((i) => i.level === "error")).toEqual([]);
  });

  it("빈칸은 0으로 넣고 알림, 숫자 글자('12')는 숫자로, 수식은 계산된 값으로", async () => {
    const a = screen();
    const buf = await edit(await template(a), (ws, m) => {
      const row = m.rows.subjects["국어"];
      ws.getCell(row, m.cols[0]).value = null;
      ws.getCell(row, m.cols[1]).value = "12";
      ws.getCell(row, m.cols[2]).value = { formula: "50+2", result: 52 };
    });
    const r = await upload(buf, a);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.next.subjectHours["국어"].slice(0, 3)).toEqual([0, 12, 52]);
    expect(r.notes.join()).toContain("빈 노란 칸 1개는 0시간");
    expect(r.notes.join()).toContain("수식이 1개");
  });

  it("글자·음수·소수·너무 큰 값은 어느 칸인지 알려 주고 반영하지 않음", async () => {
    const a = screen();
    const buf = await edit(await template(a), (ws, m) => {
      const row = m.rows.subjects["수학"];
      ws.getCell(row, m.cols[0]).value = "열";
      ws.getCell(row, m.cols[1]).value = -3;
      ws.getCell(row, m.cols[2]).value = 10.5;
      ws.getCell(m.rows.creative.club!, m.cols[3]).value = 999;
    });
    const r = await upload(buf, a);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toContain("4칸");
    const p = r.problems.join("\n");
    expect(p).toContain("숫자가 아니에요");
    expect(p).toContain("음수");
    expect(p).toContain("소수");
    expect(p).toContain("너무 커요");
    expect(p).toContain("(수학 3학년 1학기 (2027))");
  });

  it("다른 학년·학년도 화면에는 반영하지 않음", async () => {
    const a = screen();
    const buf = await template(a);
    const otherYear = await upload(buf, a, { grade: 3, schoolYear: 2028 });
    expect(otherYear.ok === false && otherYear.error).toContain("2027학년도 3학년 화면에서 받은");
    const b56 = defaultAllocation("5-6");
    const other = await upload(await template(b56, 5, 2027), a);
    expect(other.ok).toBe(false);
  });

  it("양식을 받은 뒤 ①이 바뀌면 막고 무엇이 다른지 알려 줌", async () => {
    const a = screen();
    const buf = await template(a);
    const changed = structuredClone(a);
    changed.courses[1].hours = 30;
    changed.courses.push({ name: "새 활동", subjectKey: "국어", semester: 3, hours: 29 });
    const r = await upload(buf, changed);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toContain("① 학교자율시간 과목·활동이 바뀌었어요");
    expect(r.problems.join()).toContain("양식에만 있음: 「4학년 생태」");
    expect(r.problems.join()).toContain("지금 ①에만 있음: 「새 활동」");
  });

  it("엑셀에서 줄을 넣거나 지우면 막음", async () => {
    const a = screen();
    const buf = await edit(await template(a), (ws, m) => ws.spliceRows(m.rows.subjects["국어"], 0, [null]));
    const r = await upload(buf, a);
    expect(r.ok === false && r.error).toContain("줄을 넣거나 지운 것 같아요");
  });

  it("앱 양식이 아닌 엑셀(완성본·새 파일·깨진 파일)은 막음", async () => {
    const a = screen();
    const done = await buildAllocationXlsx(a, { years: viewYears(3, YEAR), grade: 3, schoolYear: YEAR });
    expect((await upload(done, a)).ok === false && ((await upload(done, a)) as { error: string }).error).toContain("입력 양식이 아니에요");
    const empty = new ExcelJS.Workbook();
    empty.addWorksheet("Sheet1").getCell(1, 1).value = "국어";
    expect(((await upload((await empty.xlsx.writeBuffer()) as ArrayBuffer, a)) as { error: string }).error).toContain("입력 양식이 아니에요");
    expect(((await upload(new TextEncoder().encode("hello,world").buffer as ArrayBuffer, a)) as { error: string }).error).toContain("열지 못했어요");
  });

  it("양식을 받은 뒤 기준시수를 바꿨으면 반영은 하되 알림", async () => {
    const a = screen();
    const buf = await template(a);
    const changed = structuredClone(a);
    changed.baseHours["국어"] = 400;
    const r = await upload(buf, changed);
    expect(r.ok && r.notes.join()).toContain("기준시수가 바뀌었어요(국어)");
  });

  it("5~6학년(실과 있음)과 학교자율시간이 없는 양식도 같은 방식", async () => {
    const b = defaultAllocation("5-6");
    const buf = await edit(await buildAllocationXlsx(b, { years: viewYears(5, YEAR), grade: 5, schoolYear: YEAR }, { template: true }), (ws, m) => {
      ws.getCell(m.rows.subjects["실과"], m.cols[0]).value = 20;
    });
    const r = await planTemplateApply(b, { grade: 5, schoolYear: YEAR }, ((await readAllocationTemplate(buf)) as { ok: true; read: never }).read, (s) => semesterLabelWithYear(5, YEAR, s as SemesterIndex));
    expect(r.ok && r.next.subjectHours["실과"][0]).toBe(20);
  });
});
