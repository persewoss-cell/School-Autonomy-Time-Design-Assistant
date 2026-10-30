import {
  AlignmentType,
  BorderStyle,
  Document,
  HeightRule,
  Paragraph,
  ShadingType,
  TabStopType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlignTable,
  WidthType,
} from "docx";
import type { AllocationInput, SemesterIndex } from "@/validation/allocation";
import { formModel, signed, vertical } from "@/domain/allocationForm";

/**
 * 시수 점검 결과 → '( )학년 교육과정 편성표' (.docx). 계획서·신청서 붙임.
 * 모양은 학교 편성표 양식(사용자 제공 PDF)을 따른다:
 * 구분(교과군·교과) | 기준시수(±범위) | 증감범위 | 학년별 [학년 시수 배당 | 1학기 증감·편성 | 2학기 증감·편성 | 계] | 학년군 시수 합계
 * 학교자율시간은 편성한 교과(군) 안에 따로 한 줄(주황 바탕)로 넣는다. 글자는 한 줄로 들어가게 작은 글씨.
 */

const FONT = "맑은 고딕";
const SIZE = 15; // 7.5pt
const RED = "E00000";
const BLUE = "1F3FBF";
const HEAD = "DCE3EE";
const COURSE = "FCE4D6";
const line = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
const thick = { style: BorderStyle.SINGLE, size: 12, color: "000000" };
const redLine = { style: BorderStyle.SINGLE, size: 12, color: RED };

interface C {
  text?: string | number;
  span?: number;
  rows?: number;
  bold?: boolean;
  color?: string;
  fill?: string;
  diag?: boolean;
  /** 학교자율시간 칸: 빨간 테두리 */
  red?: boolean;
}

const n = (v: number) => v.toLocaleString("ko-KR");

function cell(c: C, width: number): TableCell {
  const lines = String(c.text ?? "").split("\n");
  return new TableCell({
    columnSpan: c.span,
    rowSpan: c.rows,
    width: { size: width, type: WidthType.DXA },
    verticalAlign: VerticalAlignTable.CENTER,
    shading: c.fill ? { type: ShadingType.CLEAR, fill: c.fill, color: "auto" } : undefined,
    margins: { top: 10, bottom: 10, left: 25, right: 25 },
    borders: c.diag ? { diagonalDown: line } : c.red ? { top: redLine, bottom: redLine, left: redLine, right: redLine } : undefined,
    children: c.diag
      ? [
          new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { line: 220 }, children: [new TextRun({ text: "학년", size: SIZE, font: FONT, bold: true })] }),
          new Paragraph({ alignment: AlignmentType.LEFT, spacing: { line: 220 }, children: [new TextRun({ text: "구분", size: SIZE, font: FONT, bold: true })] }),
        ]
      : lines.map(
          (t) =>
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { line: 220 },
              children: [new TextRun({ text: t, size: SIZE, font: FONT, bold: c.bold, color: c.color })],
            }),
        ),
  });
}

export interface AllocationMeta {
  /** 학기별 학년도 [첫 학년 1학기, 2학기, 둘째 학년 1학기, 2학기] */
  years?: number[];
  /** 편성표 제목의 학년 (학년 화면) */
  grade?: number;
  /** 왼쪽 위 '2026학년도' */
  schoolYear?: number;
  schoolName?: string;
  /** 표 너비 (twips). 기본 A4 좌우 여백 25.4mm */
  width?: number;
}

/** 편성표 본문 (설계 문서 .docx의 붙임으로도 쓰임). 줄 구성은 시수 점검 화면과 같은 formModel */
export function allocationChildren(a: AllocationInput, meta: AllocationMeta = {}): (Paragraph | Table)[] {
  const m = formModel(a);
  const [g0, g1] = m.grades;
  const years = meta.years;

  // 18열: 교과 | 교과군 | 교과 | 기준 | 범위 | (배당 증감 편성 증감 편성 계)×2 | 합계  (양식 비율)
  const raw = [260, 300, 1000, 640, 520, ...[0, 1].flatMap(() => [440, 420, 440, 420, 440, 480]), 560];
  const total = meta.width ?? 9026;
  const sum = raw.reduce((x, y) => x + y, 0);
  const W = raw.map((w) => Math.floor((w * total) / sum));
  const widthOf = (col: number, span = 1) => W.slice(col, col + span).reduce((x, y) => x + y, 0);

  const rows: TableRow[] = [];
  const push = (cells: [number, C][], minHeight?: number) =>
    rows.push(
      new TableRow({
        cantSplit: true,
        height: minHeight ? { value: minHeight, rule: HeightRule.ATLEAST } : undefined,
        children: cells.map(([col, c]) => cell(c, widthOf(col, c.span))),
      }),
    );
  const vert = (t: string) => vertical(t).join("\n");
  const stackBase = (base: number, plus: boolean, d: number) => `${n(base)}\n(${plus ? "+" : "±"}${d})`;
  const stackRange = (lo: number, hi: number) => `${lo}\n~\n${hi}`;

  // ── 머리글 3줄
  const yearHead = (g: number, y?: number) => `${g}학년${y ? `(${y}학년도)` : ""}`;
  push([
    [0, { diag: true, span: 3, rows: 3, fill: HEAD }],
    [3, { text: "기준\n시수", rows: 3, bold: true, fill: HEAD }],
    [4, { text: "증감\n범위", rows: 3, bold: true, fill: HEAD }],
    [5, { text: yearHead(g0, years?.[0]), span: 6, bold: true, color: RED, fill: HEAD }],
    [11, { text: yearHead(g1, years?.[2]), span: 6, bold: true, color: RED, fill: HEAD }],
    [17, { text: `${g0}~${g1}\n학년군\n시수\n합계`, rows: 3, bold: true, fill: HEAD }],
  ]);
  push(
    [5, 11].flatMap((c): [number, C][] => [
      [c, { text: "학년\n시수\n배당", rows: 2, bold: true, fill: HEAD }],
      [c + 1, { text: "1학기", span: 2, bold: true, fill: HEAD }],
      [c + 3, { text: "2학기", span: 2, bold: true, fill: HEAD }],
      [c + 5, { text: "계", rows: 2, bold: true, fill: HEAD }],
    ]),
  );
  push(
    [6, 8, 12, 14].flatMap((c): [number, C][] => [
      [c, { text: "증감\n시수", bold: true, fill: HEAD }],
      [c + 1, { text: "편성\n시수", bold: true, fill: HEAD }],
    ]),
  );

  // ── 교과
  const subjectLineCount = m.groups.reduce((t, g) => t + g.lines.length, 0);
  let firstLine = true;
  for (const g of m.groups) {
    g.lines.forEach((ln, li) => {
      const cells: [number, C][] = [];
      if (firstLine) {
        cells.push([0, { text: vert("교과"), rows: subjectLineCount + 1, bold: true }]);
        firstLine = false;
      }
      if (li === 0) {
        if (g.merged) cells.push([1, { text: vertical(g.label).join(" "), span: 2, bold: true }]);
        else cells.push([1, { text: vert(g.label), rows: g.lines.length, bold: true }]);
      }
      if (!g.merged) {
        cells.push([2, ln.kind === "course" ? { text: ln.name, fill: COURSE, bold: true, red: true } : { text: ln.kind === "subject" ? ln.key : ln.name }]);
      }
      if (li === 0) {
        cells.push([3, { text: stackBase(g.base, g.noReduction, g.delta), rows: g.lines.length, color: BLUE }]);
        cells.push([4, { text: stackRange(g.min, g.max), rows: g.lines.length, color: BLUE }]);
      }
      for (const y of [0, 1]) {
        const col = 5 + y * 6;
        const A = (y * 2) as SemesterIndex;
        const B = (y * 2 + 1) as SemesterIndex;
        if (ln.kind === "subject") {
          const q = ln.base / 4;
          cells.push(
            [col, { text: ln.base / 2 }],
            [col + 1, { text: signed(ln.hours[A] - q), color: RED }],
            [col + 2, { text: ln.hours[A] }],
            [col + 3, { text: signed(ln.hours[B] - q), color: RED }],
            [col + 4, { text: ln.hours[B] }],
            [col + 5, { text: ln.hours[A] + ln.hours[B] }],
          );
        } else if (ln.kind === "course") {
          const at = (s: SemesterIndex) => (ln.semester === s ? ln.hours : 0);
          cells.push(
            [col, { text: "-", fill: COURSE }],
            [col + 1, { text: signed(at(A)), color: RED, bold: true, fill: COURSE }],
            [col + 2, { text: at(A) || "", fill: COURSE }],
            [col + 3, { text: signed(at(B)), color: RED, bold: true, fill: COURSE }],
            [col + 4, { text: at(B) || "", fill: COURSE }],
            [col + 5, { text: at(A) + at(B) || "", fill: COURSE }],
          );
        } else {
          cells.push([col, { text: y === 0 ? "-" : "" }], ...[1, 2, 3, 4, 5].map((k): [number, C] => [col + k, {}]));
        }
      }
      if (li === 0) cells.push([17, { text: n(g.planned), rows: g.lines.length, bold: true, color: BLUE }]);
      push(cells);
    });
  }

  const sumCells = (base: number, at: (s: SemesterIndex) => number, showDelta = true): [number, C][] =>
    [0, 1].flatMap((y): [number, C][] => {
      const col = 5 + y * 6;
      const A = at((y * 2) as SemesterIndex);
      const B = at((y * 2 + 1) as SemesterIndex);
      return [
        [col, { text: n(base / 2), bold: true }],
        [col + 1, { text: showDelta ? signed(A + B - base / 2) : "", color: RED, bold: true }],
        [col + 2, { text: n(A), bold: true }],
        [col + 3, {}],
        [col + 4, { text: n(B), bold: true }],
        [col + 5, { text: n(A + B), bold: true }],
      ];
    });
  push([
    [1, { text: "소   계", span: 2, bold: true }],
    [3, { text: n(m.subtotal.base), bold: true, color: BLUE }],
    [4, {}],
    ...sumCells(m.subtotal.base, (s) => m.subjectSem[s]),
    [17, { text: n(m.subtotal.planned), bold: true, color: BLUE }],
  ]);

  // ── 창의적 체험활동
  const c = m.creative;
  c.parts.forEach((p, k) => {
    const cells: [number, C][] = [];
    if (k === 0) cells.push([0, { text: vert("창의적체험활동"), rows: 4, bold: true }]);
    cells.push([1, { text: p.name, span: 2 }]);
    if (k === 0) {
      cells.push([3, { text: stackBase(c.base, false, c.delta), rows: 3, color: BLUE }]);
      cells.push([4, { text: stackRange(c.min, c.max), rows: 3, color: BLUE }]);
    }
    for (const y of [0, 1]) {
      const col = 5 + y * 6;
      const A = (y * 2) as SemesterIndex;
      const B = (y * 2 + 1) as SemesterIndex;
      if (k === 0) {
        cells.push([col, { text: c.base / 2, rows: 3 }]);
        cells.push([col + 1, { text: signed(m.creativeSem[A] - c.base / 4), rows: 3, color: RED }]);
      }
      cells.push([col + 2, { text: p.hours[A] }]);
      if (k === 0) cells.push([col + 3, { text: signed(m.creativeSem[B] - c.base / 4), rows: 3, color: RED }]);
      cells.push([col + 4, { text: p.hours[B] }]);
      if (k === 0) cells.push([col + 5, { text: m.creativeSem[A] + m.creativeSem[B], rows: 3 }]);
    }
    if (k === 0) cells.push([17, { text: n(c.planned), rows: 3, bold: true, color: BLUE }]);
    // 세로 글자 높이를 네 줄에 고르게 나눠 마지막 줄만 길어지지 않게
    push(cells, 420);
  });
  push(
    [
      [1, { text: "소   계", span: 2, bold: true }],
      [3, { text: n(c.base), bold: true, color: BLUE }],
      [4, {}],
      ...sumCells(c.base, (s) => m.creativeSem[s]),
      [17, { text: n(c.planned), bold: true, color: BLUE }],
    ],
    420,
  );

  push([
    [0, { text: "연간수업시간수", span: 3, bold: true }],
    [3, { text: n(m.total.base), bold: true, color: BLUE }],
    [4, {}],
    ...sumCells(m.total.base, (s) => m.subjectSem[s] + m.creativeSem[s], false),
    [17, { text: n(m.total.planned), bold: true, color: BLUE }],
  ]);

  const grade = meta.grade ?? g0;
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 160 },
      children: [new TextRun({ text: `${grade}학년 교육과정 편성표`, bold: true, size: 32, font: FONT })],
    }),
    new Paragraph({
      tabStops: [{ type: TabStopType.RIGHT, position: total }],
      spacing: { after: 60 },
      children: [
        new TextRun({ text: meta.schoolYear ? `${meta.schoolYear}학년도` : "", size: 20, font: FONT }),
        new TextRun({ text: `\t${meta.schoolName ?? ""}`, size: 20, font: FONT }),
      ],
    }),
    new Table({
      width: { size: total, type: WidthType.DXA },
      columnWidths: W,
      borders: { top: thick, bottom: thick, left: line, right: line, insideHorizontal: line, insideVertical: line },
      rows,
    }),
  ];
}

export function buildAllocationDocx(a: AllocationInput, meta: AllocationMeta = {}): Document {
  const width = 11906 - 1600;
  return new Document({
    creator: "학교자율시간 설계 도우미 앱",
    styles: { default: { document: { run: { font: FONT, size: 20 } } } },
    sections: [
      {
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1000, bottom: 1000, left: 800, right: 800 } } },
        children: allocationChildren(a, { ...meta, width }),
      },
    ],
  });
}
