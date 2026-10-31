import type { Borders, Cell, Fill, Font, Worksheet } from "exceljs";
import { checkAllocation, type AllocationInput, type SemesterIndex } from "@/validation/allocation";
import { formModel } from "@/domain/allocationForm";
import type { AllocationMeta } from "./allocationDocx";

/**
 * 시수 점검 결과 → '( )학년 교육과정 편성표' (.xlsx).
 * 모양은 .docx 편성표와 같고, 노란 칸(학기별 편성 시수·학교자율시간 시수)을 바꾸면
 * 증감·계·소계·학년군 합계·연간 수업 시간 수·판정(이상없음/범위 밖)이 수식으로 다시 계산된다.
 * exceljs는 화면에서 내려받을 때만 불러온다 (처음 열리는 속도에 영향 없게).
 */

// 열: A 교과 | B 교과군 | C 교과 | D 기준시수 | E 증감범위 | 학년별 [배당 증감 편성 증감 편성 계] × 2 (F~K, L~Q) | R 학년군 합계 | S 판정
const COL = { label: 1, group: 2, subject: 3, base: 4, range: 5, year: [6, 12], total: 18, judge: 19 } as const;
const L = (c: number) => String.fromCharCode(64 + c);
const RED = "FFE00000";
const BLUE = "FF1F3FBF";
const HEAD: Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCE3EE" } };
const INPUT: Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } };
const COURSE: Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFCE4D6" } };
const SIGNED = '+0;-0;""';
const thin = { style: "thin" as const, color: { argb: "FF000000" } };
const BORDER: Partial<Borders> = { top: thin, bottom: thin, left: thin, right: thin };

interface Opt {
  fill?: Fill;
  font?: Partial<Font>;
  fmt?: string;
}

export async function buildAllocationXlsx(a: AllocationInput, meta: AllocationMeta = {}): Promise<ArrayBuffer> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "학교자율시간 설계 도우미 앱";
  const m = formModel(a);
  const r = checkAllocation(a);
  const [g0, g1] = m.grades;
  const grade = meta.grade ?? g0;
  const ws = wb.addWorksheet(`${grade}학년 편성표`, {
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } },
  });
  ws.columns = [4, 9, 14, 8, 9, ...[0, 1].flatMap(() => [6, 6, 6, 6, 6, 7]), 9, 10].map((width) => ({ width }));

  /** 칸에 값/수식 쓰기 (result는 엑셀이 다시 계산하기 전 보이는 값) */
  const put = (row: number, col: number, v: string | number | { formula: string; result?: number | string } | null, o: Opt = {}): Cell => {
    const c = ws.getCell(row, col);
    c.value = v as Cell["value"];
    c.border = BORDER;
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.font = { name: "맑은 고딕", size: 9, ...o.font };
    if (o.fill) c.fill = o.fill;
    if (o.fmt) c.numFmt = o.fmt;
    return c;
  };
  const merge = (r1: number, c1: number, r2: number, c2: number) => {
    if (r1 !== r2 || c1 !== c2) ws.mergeCells(r1, c1, r2, c2);
  };
  const f = (formula: string, result: number | string) => ({ formula, result });
  const judge = (row: number, min: number, max: number, ok: boolean) =>
    f(`IF(AND(${L(COL.total)}${row}>=${min},${L(COL.total)}${row}<=${max}),"이상없음","범위 밖")`, ok ? "이상없음" : "범위 밖");

  // ── 제목
  ws.mergeCells(1, 1, 1, COL.judge);
  Object.assign(ws.getCell(1, 1), { value: `${grade}학년 교육과정 편성표` });
  ws.getCell(1, 1).font = { name: "맑은 고딕", size: 16, bold: true };
  ws.getCell(1, 1).alignment = { horizontal: "center" };
  ws.getCell(2, 1).value = meta.schoolYear ? `${meta.schoolYear}학년도` : "";
  ws.mergeCells(2, 1, 2, 4);
  ws.mergeCells(2, 15, 2, COL.judge);
  ws.getCell(2, 15).value = meta.schoolName ?? "";
  ws.getCell(2, 15).alignment = { horizontal: "right" };
  ws.mergeCells(3, 1, 3, COL.judge);
  ws.getCell(3, 1).value = "노란 칸의 숫자를 바꾸면 증감·계·합계·판정이 자동으로 다시 계산돼요. (학교자율시간은 주황 줄)";
  ws.getCell(3, 1).font = { name: "맑은 고딕", size: 9, color: { argb: "FF666666" } };

  // ── 머리글 (4~6줄)
  const H = 4;
  const head = (row: number, col: number, text: string, o: Opt = {}) => put(row, col, text, { fill: HEAD, font: { bold: true, ...o.font } });
  head(H, 1, "구분"); merge(H, 1, H + 2, 3);
  head(H, COL.base, "기준\n시수"); merge(H, COL.base, H + 2, COL.base);
  head(H, COL.range, "증감\n범위"); merge(H, COL.range, H + 2, COL.range);
  [g0, g1].forEach((g, y) => {
    const c = COL.year[y];
    const yr = meta.years?.[y * 2];
    head(H, c, `${g}학년${yr ? `(${yr}학년도)` : ""}`, { font: { color: { argb: RED } } });
    merge(H, c, H, c + 5);
    head(H + 1, c, "학년\n시수\n배당"); merge(H + 1, c, H + 2, c);
    head(H + 1, c + 1, "1학기"); merge(H + 1, c + 1, H + 1, c + 2);
    head(H + 1, c + 3, "2학기"); merge(H + 1, c + 3, H + 1, c + 4);
    head(H + 1, c + 5, "계"); merge(H + 1, c + 5, H + 2, c + 5);
    for (const k of [1, 3]) {
      head(H + 2, c + k, "증감\n시수");
      head(H + 2, c + k + 1, "편성\n시수");
    }
  });
  head(H, COL.total, `${g0}~${g1}\n학년군\n합계`); merge(H, COL.total, H + 2, COL.total);
  head(H, COL.judge, "판정"); merge(H, COL.judge, H + 2, COL.judge);
  for (let c = 1; c <= COL.judge; c++) for (let rr = H; rr <= H + 2; rr++) ws.getCell(rr, c).border = BORDER;
  ws.getRow(H + 1).height = 30;
  ws.getRow(H + 2).height = 26;

  // ── 교과
  let row = H + 3;
  const firstSubjectRow = row;
  for (const [gi, g] of m.groups.entries()) {
    const start = row;
    const gr = r.groups[gi];
    for (const ln of g.lines) {
      if (!g.merged) put(row, COL.subject, ln.kind === "subject" ? ln.key : ln.name, ln.kind === "course" ? { fill: COURSE, font: { bold: true } } : {});
      [0, 1].forEach((y) => {
        const c = COL.year[y];
        const A = (y * 2) as SemesterIndex;
        const B = (y * 2 + 1) as SemesterIndex;
        const [h1, h2, sum] = [L(c + 2), L(c + 4), L(c + 5)];
        if (ln.kind === "subject") {
          const q = ln.base / 4;
          put(row, c, ln.base / 2);
          put(row, c + 1, f(`${h1}${row}-${q}`, ln.hours[A] - q), { fmt: SIGNED, font: { color: { argb: RED } } });
          put(row, c + 2, ln.hours[A], { fill: INPUT });
          put(row, c + 3, f(`${h2}${row}-${q}`, ln.hours[B] - q), { fmt: SIGNED, font: { color: { argb: RED } } });
          put(row, c + 4, ln.hours[B], { fill: INPUT });
          put(row, c + 5, f(`${h1}${row}+${h2}${row}`, ln.hours[A] + ln.hours[B]), { font: { bold: true } });
        } else if (ln.kind === "course") {
          const at = (s: SemesterIndex) => (ln.semester === s ? ln.hours : 0);
          put(row, c, "-", { fill: COURSE });
          put(row, c + 1, f(`${h1}${row}`, at(A)), { fmt: SIGNED, fill: COURSE, font: { color: { argb: RED }, bold: true } });
          put(row, c + 2, at(A) || null, { fill: INPUT });
          put(row, c + 3, f(`${h2}${row}`, at(B)), { fmt: SIGNED, fill: COURSE, font: { color: { argb: RED }, bold: true } });
          put(row, c + 4, at(B) || null, { fill: INPUT });
          put(row, c + 5, f(`${h1}${row}+${h2}${row}`, at(A) + at(B)), { fmt: '0;-0;""', fill: COURSE, font: { bold: true } });
        } else {
          for (let k = 0; k < 6; k++) put(row, c + k, k === 0 && y === 0 ? "-" : null);
        }
      });
      row++;
    }
    const end = row - 1;
    // 교과군 칸·기준·범위·합계·판정은 교과군 줄 전체에 걸쳐 합친다
    put(start, COL.group, g.label, { font: { bold: true } });
    if (g.merged) merge(start, COL.group, end, COL.subject);
    else merge(start, COL.group, end, COL.group);
    put(start, COL.base, `${g.base}\n(${g.noReduction ? "+" : "±"}${g.delta})`, { font: { color: { argb: BLUE } } });
    merge(start, COL.base, end, COL.base);
    put(start, COL.range, `${g.min}~${g.max}`, { font: { color: { argb: BLUE } } });
    merge(start, COL.range, end, COL.range);
    const k0 = L(COL.year[0] + 5);
    const k1 = L(COL.year[1] + 5);
    put(start, COL.total, f(`SUM(${k0}${start}:${k0}${end})+SUM(${k1}${start}:${k1}${end})`, g.planned), { font: { bold: true, color: { argb: BLUE } } });
    merge(start, COL.total, end, COL.total);
    put(start, COL.judge, judge(start, gr.min, gr.max, gr.ok), { font: { bold: true } });
    merge(start, COL.judge, end, COL.judge);
  }
  const lastSubjectRow = row - 1;

  /** 소계·연간 줄: 학기별 편성 합 (sumOf: 열 문자 → 수식), 증감 = 1·2학기 합 − 배당 */
  const sumRow = (label: string, base: number, sumOf: (col: string) => string, results: [number, number, number, number], showDelta: boolean, judgeCell: { formula: string; result?: number | string }, labelCols: [number, number]) => {
    put(row, labelCols[0], label, { font: { bold: true } });
    merge(row, labelCols[0], row, labelCols[1]);
    put(row, COL.base, base, { font: { bold: true, color: { argb: BLUE } } });
    put(row, COL.range, null);
    [0, 1].forEach((y) => {
      const c = COL.year[y];
      const [h1, h2] = [L(c + 2), L(c + 4)];
      const [A, B] = [results[y * 2], results[y * 2 + 1]];
      put(row, c, base / 2, { font: { bold: true } });
      put(row, c + 1, showDelta ? f(`${h1}${row}+${h2}${row}-${L(c)}${row}`, A + B - base / 2) : null, { fmt: SIGNED, font: { bold: true, color: { argb: RED } } });
      put(row, c + 2, f(sumOf(h1), A), { font: { bold: true } });
      put(row, c + 3, null);
      put(row, c + 4, f(sumOf(h2), B), { font: { bold: true } });
      put(row, c + 5, f(`${h1}${row}+${h2}${row}`, A + B), { font: { bold: true } });
    });
    put(row, COL.total, f(`${L(COL.year[0] + 5)}${row}+${L(COL.year[1] + 5)}${row}`, results.reduce((x, y) => x + y, 0)), { font: { bold: true, color: { argb: BLUE } } });
    put(row, COL.judge, judgeCell, { font: { bold: true } });
    return row++;
  };
  const subtotalRow = sumRow(
    "소   계",
    m.subtotal.base,
    (col) => `SUM(${col}${firstSubjectRow}:${col}${lastSubjectRow})`,
    m.subjectSem,
    true,
    judge(row, r.subtotal.min, r.subtotal.max, r.subtotal.ok),
    [COL.group, COL.subject],
  );
  put(firstSubjectRow, COL.label, "교\n\n과", { font: { bold: true } });
  merge(firstSubjectRow, COL.label, subtotalRow, COL.label);

  // ── 창의적 체험활동 (3줄 + 소계)
  const cr = m.creative;
  const c0 = row;
  cr.parts.forEach((p, k) => {
    put(row, COL.group, p.name);
    merge(row, COL.group, row, COL.subject);
    [0, 1].forEach((y) => {
      const c = COL.year[y];
      put(row, c + 2, p.hours[y * 2], { fill: INPUT });
      put(row, c + 4, p.hours[y * 2 + 1], { fill: INPUT });
      if (k > 0) for (const kk of [0, 1, 3, 5]) put(row, c + kk, null);
    });
    if (k > 0) for (const col of [COL.base, COL.range, COL.total, COL.judge]) put(row, col, null);
    row++;
  });
  const c2 = row - 1;
  put(c0, COL.base, `${cr.base}\n(±${cr.delta})`, { font: { color: { argb: BLUE } } });
  merge(c0, COL.base, c2, COL.base);
  put(c0, COL.range, `${cr.min}~${cr.max}`, { font: { color: { argb: BLUE } } });
  merge(c0, COL.range, c2, COL.range);
  [0, 1].forEach((y) => {
    const c = COL.year[y];
    const [h1, h2] = [L(c + 2), L(c + 4)];
    const q = cr.base / 4;
    const [A, B] = [m.creativeSem[y * 2], m.creativeSem[y * 2 + 1]];
    put(c0, c, cr.base / 2);
    merge(c0, c, c2, c);
    put(c0, c + 1, f(`SUM(${h1}${c0}:${h1}${c2})-${q}`, A - q), { fmt: SIGNED, font: { color: { argb: RED } } });
    merge(c0, c + 1, c2, c + 1);
    put(c0, c + 3, f(`SUM(${h2}${c0}:${h2}${c2})-${q}`, B - q), { fmt: SIGNED, font: { color: { argb: RED } } });
    merge(c0, c + 3, c2, c + 3);
    put(c0, c + 5, f(`SUM(${h1}${c0}:${h1}${c2})+SUM(${h2}${c0}:${h2}${c2})`, A + B), { font: { bold: true } });
    merge(c0, c + 5, c2, c + 5);
  });
  put(c0, COL.total, f(`${L(COL.year[0] + 5)}${c0}+${L(COL.year[1] + 5)}${c0}`, cr.planned), { font: { bold: true, color: { argb: BLUE } } });
  merge(c0, COL.total, c2, COL.total);
  put(c0, COL.judge, judge(c0, cr.min, cr.max, cr.ok), { font: { bold: true } });
  merge(c0, COL.judge, c2, COL.judge);
  const creativeSubtotal = sumRow("소   계", cr.base, (col) => `SUM(${col}${c0}:${col}${c2})`, m.creativeSem, true, judge(row, cr.min, cr.max, cr.ok), [COL.group, COL.subject]);
  put(c0, COL.label, "창\n체", { font: { bold: true } });
  merge(c0, COL.label, creativeSubtotal, COL.label);

  // ── 연간 수업 시간 수: 기준과 같아야 이상없음
  const totalBase = m.total.base;
  const T = `${L(COL.total)}${row}`;
  sumRow(
    "연간수업시간수",
    totalBase,
    (col) => `${col}${subtotalRow}+${col}${creativeSubtotal}`,
    [0, 1, 2, 3].map((s) => m.subjectSem[s] + m.creativeSem[s]) as [number, number, number, number],
    false,
    f(`IF(${T}=${totalBase},"이상없음",IF(${T}>${totalBase},"기준보다 "&(${T}-${totalBase})&"시간 많음","기준보다 "&(${totalBase}-${T})&"시간 적음"))`, m.total.ok ? "이상없음" : m.total.planned > totalBase ? `기준보다 ${m.total.planned - totalBase}시간 많음` : `기준보다 ${totalBase - m.total.planned}시간 적음`),
    [COL.label, COL.subject],
  );

  judgeColors(ws, L(COL.judge), H + 3, row - 1);
  ws.views = [{ state: "frozen", ySplit: H + 2, xSplit: 3 }];
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

/** 판정 칸 글자색: 이상없음 초록, 나머지 빨강 (조건부 서식이라 숫자를 바꾸면 색도 바뀜) */
function judgeColors(ws: Worksheet, col: string, from: number, to: number) {
  ws.addConditionalFormatting({
    ref: `${col}${from}:${col}${to}`,
    rules: [
      { type: "containsText", operator: "containsText", text: "이상없음", priority: 1, style: { font: { color: { argb: "FF008000" }, bold: true } } },
      { type: "expression", formulae: [`AND(${col}${from}<>"",ISERROR(SEARCH("이상없음",${col}${from})))`], priority: 2, style: { font: { color: { argb: RED }, bold: true } } },
    ],
  });
}
