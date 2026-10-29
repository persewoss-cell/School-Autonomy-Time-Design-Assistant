import { AlignmentType, BorderStyle, Document, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, VerticalAlignTable, WidthType } from "docx";
import { bandInfo, checkAllocation, semesterLabel, type AllocationInput, type SemesterIndex } from "@/validation/allocation";

/** 시수 점검 결과 → 교육과정 편성표(.docx). 서식1·3의 붙임 '( )학년 교육과정 편성표'로 쓸 수 있다. */

const FONT = "맑은 고딕";
const GRAY = "E8EFEB";
const border = { style: BorderStyle.SINGLE, size: 4, color: "555555" };
const SEMS: SemesterIndex[] = [0, 1, 2, 3];

const cell = (text: string | number, o: { head?: boolean; span?: number } = {}) =>
  new TableCell({
    columnSpan: o.span,
    verticalAlign: VerticalAlignTable.CENTER,
    shading: o.head ? { type: ShadingType.CLEAR, fill: GRAY, color: "auto" } : undefined,
    margins: { top: 40, bottom: 40, left: 60, right: 60 },
    children: String(text)
      .split("\n")
      .map((t) => new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: t, bold: o.head, size: 18, font: FONT })] })),
  });

export function buildAllocationDocx(a: AllocationInput): Document {
  const info = bandInfo(a.band);
  const r = checkAllocation(a);
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  const header = [
    cell("교과(군)", { head: true }),
    cell("교과", { head: true }),
    cell("기준\n시수", { head: true }),
    ...SEMS.map((s) => cell(semesterLabel(a.band, s).replace(" ", "\n"), { head: true })),
    cell("학교자율\n시간", { head: true }),
    cell("편성\n시수", { head: true }),
    cell("증감\n범위", { head: true }),
    cell("이상\n유무", { head: true }),
  ];
  const rows: TableCell[][] = [header];
  info.subjects.forEach((s, i) => {
    const row = r.rows[i];
    rows.push([
      cell(s.group),
      cell(s.key),
      cell(row.baseHours),
      ...SEMS.map((sem) => cell(a.subjectHours[s.key][sem])),
      cell(row.autonomy || "-"),
      cell(row.planned),
      cell(`${row.min}~${row.max}`),
      cell(row.ok ? "이상없음" : "점검필요"),
    ]);
  });
  rows.push([cell("교과 소계", { head: true, span: 2 }), cell(r.subtotal.baseHours), ...SEMS.map(() => cell("")), cell(r.subtotal.autonomy || "-"), cell(r.subtotal.planned), cell(`${r.subtotal.min}~${r.subtotal.max}`), cell(r.subtotal.ok ? "이상없음" : "점검필요")]);
  rows.push([cell("창의적 체험활동", { head: true, span: 2 }), cell(r.creative.baseHours), ...SEMS.map((s) => cell(a.creativeHours[s])), cell("-"), cell(r.creative.planned), cell(`${r.creative.min}~${r.creative.max}`), cell(r.creative.ok ? "이상없음" : "점검필요")]);
  rows.push([cell("학년군 총 수업 시간 수", { head: true, span: 2 }), cell(r.total.baseHours), ...SEMS.map(() => cell("")), cell(""), cell(r.total.planned), cell(""), cell(r.total.ok ? "이상없음" : "점검필요")]);

  const courseRows: TableCell[][] = [
    [cell("과목·활동명", { head: true }), cell("편성 교과", { head: true }), cell("학년·학기", { head: true }), cell("시수", { head: true })],
    ...a.courses.map((c) => [cell(c.name), cell(c.subjectKey), cell(semesterLabel(a.band, c.semester)), cell(c.hours)]),
  ];
  const tbl = (rs: TableCell[][]) =>
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
      rows: rs.map((cells) => new TableRow({ children: cells })),
    });
  const p = (text: string, bold = false, size = 20) => new Paragraph({ spacing: { before: 160, after: 80 }, children: [new TextRun({ text, bold, size, font: FONT })] });

  return new Document({
    creator: "학교자율시간 설계 도우미 앱",
    styles: { default: { document: { run: { font: FONT, size: 20 } } } },
    sections: [
      {
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1000, bottom: 1000, left: 800, right: 800 } } },
        children: [
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: `${info.label} 교육과정 편성표 (학교자율시간 시수 편성 점검)`, bold: true, size: 30, font: FONT })] }),
          p("1. 학교자율시간 과목·활동", true),
          tbl(courseRows),
          p(`※ 운영 학기의 학교자율시간 합계: ${r.semesterTarget}시간(1주 분량) · 1주 수업시간 = 기준시수 ÷ 34 ÷ 2`, false, 18),
          p("2. 교과·창의적 체험활동 편성", true),
          tbl(rows),
          p(`점검 결과: ${r.issues.length === 0 ? "이상 없음" : `점검 필요 ${r.issues.length}건 — ${r.issues.map((i) => i.field).join(", ")}`}`, false, 18),
          p(`1주 수업시간: ${info.subjects.map((s, i) => `${s.key} ${fmt(r.rows[i].oneWeek)}`).join(", ")}, 창체 ${fmt(r.creative.oneWeek)}`, false, 16),
        ],
      },
    ],
  });
}
