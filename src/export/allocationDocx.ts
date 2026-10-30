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
import { bandInfo, checkAllocation, creativePartsOf, CREATIVE_PARTS, type AllocationInput, type SemesterIndex } from "@/validation/allocation";

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
const HEAD = "F2F2F2";
const COURSE = "FCE4D6";
const SEMS: SemesterIndex[] = [0, 1, 2, 3];
const line = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
const thick = { style: BorderStyle.SINGLE, size: 12, color: "000000" };

interface C {
  text?: string | number;
  span?: number;
  rows?: number;
  bold?: boolean;
  color?: string;
  fill?: string;
  diag?: boolean;
}

const n = (v: number) => v.toLocaleString("ko-KR");
const signed = (v: number) => (v === 0 ? "" : v > 0 ? `+${v}` : String(v));

function cell(c: C, width: number): TableCell {
  const lines = String(c.text ?? "").split("\n");
  return new TableCell({
    columnSpan: c.span,
    rowSpan: c.rows,
    width: { size: width, type: WidthType.DXA },
    verticalAlign: VerticalAlignTable.CENTER,
    shading: c.fill ? { type: ShadingType.CLEAR, fill: c.fill, color: "auto" } : undefined,
    margins: { top: 10, bottom: 10, left: 25, right: 25 },
    borders: c.diag ? { diagonalDown: line } : undefined,
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

/** 편성표 본문 (설계 문서 .docx의 붙임으로도 쓰임) */
export function allocationChildren(a: AllocationInput, meta: AllocationMeta = {}): (Paragraph | Table)[] {
  const info = bandInfo(a.band);
  const r = checkAllocation(a);
  const parts = creativePartsOf(a);
  const g0 = info.grades[0];
  const g1 = info.grades[1];
  const years = meta.years;

  // 열 너비 (양식 비율). 18열: 교과 | 교과군 | 교과 | 기준 | 범위 | (배당 증감 편성 증감 편성 계)×2 | 합계
  const raw = [300, 760, 1150, 820, 760, ...[0, 1].flatMap(() => [430, 400, 430, 400, 430, 470]), 560];
  const total = meta.width ?? 9026;
  const sum = raw.reduce((x, y) => x + y, 0);
  const W = raw.map((w) => Math.floor((w * total) / sum));
  const widthOf = (col: number, span = 1) => W.slice(col, col + span).reduce((x, y) => x + y, 0);

  /** 행 만들기: 각 칸이 몇 번째 열에서 시작하는지 알려 줘야 너비를 정확히 넣을 수 있다 */
  const rows: TableRow[] = [];
  const push = (cells: [number, C][], minHeight?: number) =>
    rows.push(
      new TableRow({
        cantSplit: true,
        height: minHeight ? { value: minHeight, rule: HeightRule.ATLEAST } : undefined,
        children: cells.map(([col, c]) => cell(c, widthOf(col, c.span))),
      }),
    );

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

  // ── 교과: 교과(군)마다 교과 줄 + 그 교과에 편성한 학교자율시간 줄
  type Line = { kind: "subject"; key: string } | { kind: "course"; i: number };
  const groupLines = r.groups.map((g) => ({
    g,
    lines: g.keys.flatMap((k): Line[] => [
      { kind: "subject", key: k },
      ...a.courses.flatMap((c, i): Line[] => (c.subjectKey === k ? [{ kind: "course", i }] : [])),
    ]),
  }));
  const subjectLineCount = groupLines.reduce((t, x) => t + x.lines.length, 0);
  const rule = (k: string) => info.subjects.find((s) => s.key === k)!;
  let firstSubjectLine = true;

  for (const { g, lines } of groupLines) {
    const delta = g.max - g.baseHours;
    const noReduction = g.keys.some((k) => rule(k).noReduction);
    lines.forEach((ln, li) => {
      const cells: [number, C][] = [];
      if (firstSubjectLine) {
        cells.push([0, { text: "교\n\n과", rows: subjectLineCount + 1, bold: true }]);
        firstSubjectLine = false;
      }
      const single = lines.length === 1 && ln.kind === "subject";
      if (li === 0) {
        if (single) cells.push([1, { text: g.label, span: 2, bold: true }]);
        else cells.push([1, { text: g.label, rows: lines.length, bold: true }]);
      }
      if (ln.kind === "subject") {
        if (!single) cells.push([2, { text: ln.key }]);
      } else {
        cells.push([2, { text: a.courses[ln.i].name || "학교자율시간", fill: COURSE, bold: true }]);
      }
      if (li === 0) {
        cells.push([3, { text: `${n(g.baseHours)}(${noReduction ? "+" : "±"}${delta})`, rows: lines.length, color: BLUE }]);
        cells.push([4, { text: `${g.min}~${g.max}`, rows: lines.length, color: BLUE }]);
      }
      for (const y of [0, 1]) {
        const col = 5 + y * 6;
        const semA = (y * 2) as SemesterIndex;
        const semB = (y * 2 + 1) as SemesterIndex;
        if (ln.kind === "subject") {
          const base = a.baseHours[ln.key] ?? rule(ln.key).baseHours;
          const h = a.subjectHours[ln.key] ?? [0, 0, 0, 0];
          const quarter = base / 4;
          cells.push(
            [col, { text: base / 2 }],
            [col + 1, { text: signed(h[semA] - quarter), color: RED }],
            [col + 2, { text: h[semA] }],
            [col + 3, { text: signed(h[semB] - quarter), color: RED }],
            [col + 4, { text: h[semB] }],
            [col + 5, { text: h[semA] + h[semB] }],
          );
        } else {
          const c = a.courses[ln.i];
          const at = (s: SemesterIndex) => (c.semester === s ? c.hours : 0);
          cells.push(
            [col, { text: "-", fill: COURSE }],
            [col + 1, { text: signed(at(semA)), color: RED, fill: COURSE }],
            [col + 2, { text: at(semA) || "", fill: COURSE }],
            [col + 3, { text: signed(at(semB)), color: RED, fill: COURSE }],
            [col + 4, { text: at(semB) || "", fill: COURSE }],
            [col + 5, { text: at(semA) + at(semB) || "", fill: COURSE }],
          );
        }
      }
      if (li === 0) cells.push([17, { text: n(g.planned), rows: lines.length, bold: true, color: BLUE }]);
      push(cells);
    });
  }

  // 교과 소계 (학교자율시간 포함)
  const semTotal = (s: SemesterIndex) =>
    info.subjects.reduce((t, x) => t + (a.subjectHours[x.key]?.[s] ?? 0), 0) + a.courses.filter((c) => c.semester === s).reduce((t, c) => t + c.hours, 0);
  const sumCells = (base: number, at: (s: SemesterIndex) => number, bold = true): [number, C][] =>
    [0, 1].flatMap((y): [number, C][] => {
      const col = 5 + y * 6;
      const A = at((y * 2) as SemesterIndex);
      const B = at((y * 2 + 1) as SemesterIndex);
      return [
        [col, { text: n(base / 2), bold }],
        [col + 1, { text: signed(A + B - base / 2), color: RED, bold }],
        [col + 2, { text: n(A), bold }],
        [col + 3, { text: "", bold }],
        [col + 4, { text: n(B), bold }],
        [col + 5, { text: n(A + B), bold }],
      ];
    });
  push([
    [1, { text: "소   계", span: 2, bold: true }],
    [3, { text: n(r.subtotal.baseHours), bold: true, color: BLUE }],
    [4, { text: "" }],
    ...sumCells(r.subtotal.baseHours, semTotal),
    [17, { text: n(r.subtotal.planned), bold: true, color: BLUE }],
  ]);

  // ── 창의적 체험활동: 자율·자치 / 동아리 / 진로 + 소계
  const cb = a.creativeBaseHours;
  const cDelta = Math.floor(cb * 0.2);
  CREATIVE_PARTS.forEach(([key, name], k) => {
    const cells: [number, C][] = [];
    if (k === 0) cells.push([0, { text: "창\n의\n적\n체\n험\n활\n동", rows: 4, bold: true }]);
    cells.push([1, { text: name, span: 2 }]);
    if (k === 0) {
      cells.push([3, { text: `${n(cb)}(±${cDelta})`, rows: 3, color: BLUE }]);
      cells.push([4, { text: `${r.creative.min}~${r.creative.max}`, rows: 3, color: BLUE }]);
    }
    for (const y of [0, 1]) {
      const col = 5 + y * 6;
      const semA = (y * 2) as SemesterIndex;
      const semB = (y * 2 + 1) as SemesterIndex;
      if (k === 0) {
        cells.push([col, { text: cb / 2, rows: 3 }]);
        cells.push([col + 1, { text: signed(a.creativeHours[semA] - cb / 4), rows: 3, color: RED }]);
      }
      cells.push([col + 2, { text: parts[key][semA] }]);
      if (k === 0) cells.push([col + 3, { text: signed(a.creativeHours[semB] - cb / 4), rows: 3, color: RED }]);
      cells.push([col + 4, { text: parts[key][semB] }]);
      if (k === 0) cells.push([col + 5, { text: a.creativeHours[semA] + a.creativeHours[semB], rows: 3 }]);
    }
    if (k === 0) cells.push([17, { text: n(r.creative.planned), rows: 3, bold: true, color: BLUE }]);
    // 세로 글자(창의적체험활동) 높이를 네 줄에 고르게 나눠 마지막 줄만 길어지지 않게
    push(cells, 400);
  });
  push([
    [1, { text: "소   계", span: 2, bold: true }],
    [3, { text: n(cb), bold: true, color: BLUE }],
    [4, { text: "" }],
    ...sumCells(cb, (s) => a.creativeHours[s]),
    [17, { text: n(r.creative.planned), bold: true, color: BLUE }],
  ], 400);

  // 연간 수업 시간 수
  push([
    [0, { text: "연간수업시간수", span: 3, bold: true }],
    [3, { text: n(r.total.baseHours), bold: true, color: BLUE }],
    [4, { text: "" }],
    ...sumCells(r.total.baseHours, (s) => semTotal(s) + a.creativeHours[s]).map(([c, x]): [number, C] => [c, (c - 5) % 6 === 1 ? { ...x, text: "" } : x]),
    [17, { text: n(r.total.planned), bold: true, color: BLUE }],
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
