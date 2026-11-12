import {
  AlignmentType,
  BorderStyle,
  Document,
  HeightRule,
  ImageRun,
  LineRuleType,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlignTable,
  VerticalMergeType,
  WidthType,
  type IBorderOptions,
} from "docx";
import type { DesignDoc } from "@/domain/types";
import {
  BOX_HEIGHT_CM,
  lessonSlots,
  ROW_CM,
  slotLabel,
  unitTitle,
  WORKSHEET_COLORS,
  type Worksheet,
  type WorksheetBlock,
} from "@/domain/worksheet";

/**
 * 차시별 활동지 → .docx (한글에서 열림)
 * 모양은 광양중동초 '나도 그림책 작가' 활동지: 머리칸 표 + 반·번호·이름 + 테두리 안에 ※ 안내와 번호 붙은 활동 칸.
 * 글꼴: 본문 함초롬바탕, 머리칸·표 제목 함초롬돋움 (사용자 결정, 2026-11-11)
 */

const BODY = "함초롬바탕";
const HEAD = "함초롬돋움";
/** A4 210mm - 좌우 여백 15mm씩 = 180mm (twips) */
const PAGE_W = 10205;
/** 본문 테두리 안쪽 폭 (칸 여백 빼고) */
const INNER_W = PAGE_W - 400;
const cm = (n: number) => Math.round(n * 567);

const run = (text: string, o: { bold?: boolean; size?: number; font?: string } = {}) =>
  new TextRun({ text, bold: o.bold, size: Math.round((o.size ?? 11) * 2), font: o.font ?? BODY });
const para = (text: string, o: { bold?: boolean; size?: number; font?: string; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; before?: number; after?: number } = {}) =>
  new Paragraph({
    alignment: o.align,
    spacing: { before: Math.round((o.before ?? 0) * 20), after: Math.round((o.after ?? 0) * 20), line: 300, lineRule: LineRuleType.AUTO },
    children: [run(text, o)],
  });

const line = (color: string, size = 4, style: (typeof BorderStyle)[keyof typeof BorderStyle] = BorderStyle.SINGLE): IBorderOptions => ({ style, size, color });
const none: IBorderOptions = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const allBorders = (b: IBorderOptions) => ({ top: b, bottom: b, left: b, right: b });

function cell(children: Paragraph[] | Table[] | (Paragraph | Table)[], o: { width?: number; fill?: string; span?: number; rowSpan?: number; vMerge?: "restart" | "continue"; center?: boolean; borders?: ReturnType<typeof allBorders>; top?: boolean } = {}) {
  return new TableCell({
    children: children.length ? children : [new Paragraph("")],
    width: o.width ? { size: o.width, type: WidthType.DXA } : undefined,
    columnSpan: o.span,
    rowSpan: o.rowSpan,
    verticalMerge: o.vMerge === "restart" ? VerticalMergeType.RESTART : o.vMerge === "continue" ? VerticalMergeType.CONTINUE : undefined,
    shading: o.fill ? { type: ShadingType.CLEAR, fill: o.fill, color: "auto" } : undefined,
    verticalAlign: o.top ? VerticalAlignTable.TOP : VerticalAlignTable.CENTER,
    borders: o.borders,
    margins: { top: 40, bottom: 40, left: 100, right: 100 },
  });
}
const row = (cells: TableCell[], heightCm?: number, exact = false) =>
  new TableRow({ children: cells, cantSplit: true, height: heightCm ? { value: cm(heightCm), rule: exact ? HeightRule.EXACT : HeightRule.ATLEAST } : undefined });
const table = (rows: TableRow[], widths: number[], borders?: ReturnType<typeof allBorders> & { insideHorizontal?: IBorderOptions; insideVertical?: IBorderOptions }) =>
  new Table({ rows, columnWidths: widths, width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA }, borders });

const CIRCLED = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫";

function dataUrlBytes(url: string): { data: Uint8Array; type: "png" | "jpg" } | null {
  const m = url.match(/^data:image\/(png|jpe?g);base64,(.+)$/);
  if (!m) return null;
  const bin = atob(m[2]);
  const data = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) data[i] = bin.charCodeAt(i);
  return { data, type: m[1] === "png" ? "png" : "jpg" };
}

/** 머리칸: [로고] 설계 이름 / 단원·차시 / 학습문제 */
function headerTable(doc: DesignDoc, sheet: Worksheet, unitName: string, logo: string): Table {
  const img = logo ? dataUrlBytes(logo) : null;
  const logoW = img ? cm(2.1) : 0;
  const labelW = cm(2.0);
  const noLabelW = cm(1.5);
  const noW = cm(2.0);
  const textW = PAGE_W - logoW - labelW - noLabelW - noW;
  const b = allBorders(line("000000", 6));
  const label = (t: string, w: number) => cell([para(t, { font: HEAD, align: AlignmentType.CENTER })], { width: w, borders: b });
  const logoCell = (vMerge: "restart" | "continue") =>
    cell(
      vMerge === "restart" && img
        ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: img.type, data: img.data, transformation: { width: 64, height: 64 } })] })]
        : [new Paragraph("")],
      { width: logoW, vMerge, borders: b },
    );
  const r1 = [
    ...(img ? [logoCell("restart")] : []),
    cell([para(doc.basic.name, { font: HEAD, bold: true, size: 13, align: AlignmentType.CENTER })], { span: 4, borders: b }),
  ];
  const r2 = [
    ...(img ? [logoCell("continue")] : []),
    label("단원", labelW),
    cell([para(unitName, { align: AlignmentType.CENTER })], { width: textW, borders: b }),
    label("차시", noLabelW),
    cell([para(slotLabel(sheet.no, doc), { align: AlignmentType.CENTER })], { width: noW, borders: b }),
  ];
  const r3 = [
    ...(img ? [logoCell("continue")] : []),
    label("학습문제", labelW),
    cell([para(sheet.problem)], { span: 3, borders: b }),
  ];
  return table([row(r1, 0.9), row(r2, 0.85), row(r3, 0.85)], [...(img ? [logoW] : []), labelW, textW, noLabelW, noW]);
}

function blockContent(b: WorksheetBlock, color: { line: string; fill: string }): (Paragraph | Table)[] {
  const c = line(color.line, 6);
  const grid = { ...allBorders(c), insideHorizontal: c, insideVertical: c };
  const headCell = (t: string, w: number) => cell([para(t, { font: HEAD, bold: true, align: AlignmentType.CENTER })], { width: w, fill: color.fill });
  switch (b.type) {
    case "lines":
      // 줄마다 아래 선 (이어진 문단 테두리는 한 덩어리로 합쳐지므로 표로 그림)
      return [
        table(
          Array.from({ length: b.count ?? 4 }, () => row([cell([], { width: INNER_W })], ROW_CM.line, true)),
          [INNER_W],
          { top: none, left: none, right: none, insideVertical: none, bottom: c, insideHorizontal: c },
        ),
      ];
    case "labels": {
      const w1 = Math.round(INNER_W * 0.24);
      return [table((b.rows ?? []).map((r) => row([headCell(r, w1), cell([], { width: INNER_W - w1 })], ROW_CM.label)), [w1, INNER_W - w1], grid)];
    }
    case "columns": {
      const h = b.headers ?? ["", ""];
      const w = Math.floor(INNER_W / h.length);
      const widths = h.map(() => w);
      return [table([row(h.map((t) => headCell(t, w)), ROW_CM.label), ...Array.from({ length: b.count ?? 3 }, () => row(h.map(() => cell([], { width: w })), ROW_CM.column))], widths, grid)];
    }
    case "grid": {
      const n = 20;
      const w = Math.floor(INNER_W / n);
      const dash = line(color.line, 4, BorderStyle.DASHED);
      return [
        table(
          Array.from({ length: b.count ?? 6 }, () => row(Array.from({ length: n }, () => cell([], { width: w })), ROW_CM.grid, true)),
          Array(n).fill(w),
          { ...allBorders(c), insideHorizontal: c, insideVertical: dash },
        ),
      ];
    }
    case "box":
      return [table([row([cell([], { width: INNER_W })], BOX_HEIGHT_CM[b.size ?? "medium"])], [INNER_W], grid)];
    case "numbered":
      return [
        table(
          Array.from({ length: b.count ?? 3 }, (_, i) => row([cell([para(`${i + 1}.`, { font: HEAD, bold: true })], { width: INNER_W, top: true })], ROW_CM.numbered)),
          [INNER_W],
          grid,
        ),
      ];
    case "list":
      return (b.items ?? []).map((t, i) => para(`${CIRCLED[i] ?? `${i + 1})`} ${t}`, { before: 1, after: 1 }));
    case "storyboard": {
      const n = b.count ?? 6;
      const cols = n === 4 ? 2 : 3;
      const w = Math.floor(INNER_W / cols);
      return [table(Array.from({ length: Math.ceil(n / cols) }, () => row(Array.from({ length: cols }, () => cell([], { width: w })), ROW_CM.storyboard)), Array(cols).fill(w), grid)];
    }
    case "selfcheck": {
      const s = 5;
      const sw = Math.round(INNER_W * 0.08);
      const first = INNER_W - sw * s;
      return [
        table(
          [
            row([headCell("스스로 평가해요", first), ...Array.from({ length: s }, (_, i) => headCell(String(i + 1), sw))], ROW_CM.label),
            ...(b.rows ?? []).map((r) => row([cell([para(r)], { width: first }), ...Array.from({ length: s }, () => cell([], { width: sw }))], ROW_CM.selfcheck)),
          ],
          [first, ...Array(s).fill(sw)],
          grid,
        ),
      ];
    }
    case "example":
      return [table([row([cell((b.text ?? "").split("\n").map((t) => para(t, { before: 2, after: 2 })), { width: INNER_W })], 2)], [INNER_W], grid)];
  }
}

/** 활동지 한 장 */
function sheetChildren(doc: DesignDoc, sheet: Worksheet, first: boolean): (Paragraph | Table)[] {
  const st = doc.worksheets!.settings;
  const color = WORKSHEET_COLORS[st.color] ?? WORKSHEET_COLORS.black;
  const slot = lessonSlots(doc).find((s) => s.no === sheet.no);
  const unitName = slot ? unitTitle(slot.unitName, slot.unitIndex) : "";
  const body: (Paragraph | Table)[] = [];
  if (sheet.lead.trim()) body.push(para(`※ ${sheet.lead.trim()}`, { bold: true, before: 6, after: 6 }));
  sheet.blocks.forEach((b, i) => {
    if (b.title.trim()) body.push(para(`${i + 1}. ${b.title.trim()}`, { before: 10, after: 4 }));
    else body.push(new Paragraph({ spacing: { before: 120 }, children: [] }));
    body.push(...blockContent(b, color));
  });
  body.push(new Paragraph(""));
  const frame = table([row([cell(body, { width: PAGE_W, top: true })], 22.3)], [PAGE_W], { ...allBorders(line("000000", 8)) });
  return [
    new Paragraph({ pageBreakBefore: !first, spacing: { before: 0, after: 0, line: 40, lineRule: LineRuleType.EXACT }, children: [] }),
    headerTable(doc, sheet, unitName, st.logo),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 100, after: 100 },
      children: [run(`${doc.basic.grade}학년 (      )반 (      )번   이름 (                    )`, { size: 11 })],
    }),
    frame,
  ];
}

/** 첫 장: 차시별 학습 주제 (단원명·학습주제·차시·비고) */
function topicTable(doc: DesignDoc, nos: number[]): (Paragraph | Table)[] {
  const color = WORKSHEET_COLORS[doc.worksheets!.settings.color] ?? WORKSHEET_COLORS.black;
  const kind = doc.basic.type === "subject" ? "과목" : "활동";
  const slots = lessonSlots(doc).filter((s) => nos.includes(s.no));
  const widths = [cm(3.6), PAGE_W - cm(3.6) - cm(2.2) - cm(2.2), cm(2.2), cm(2.2)];
  const b = allBorders(line("000000", 4));
  const dotted = line("000000", 4, BorderStyle.DOTTED);
  // 한 쪽에 들어가게: 차시가 많거나 학습주제가 길면 글자·줄 높이를 줄인다 (본문 약 23cm)
  const topicText = (s: (typeof slots)[number]) => `· ${s.topic}${s.parts > 1 ? ` (${s.part}/${s.parts})` : ""}`;
  const topicW = (widths[1] - 200) / 567; // cm
  const fit = (size: number, minRow: number) =>
    slots.reduce((h, s) => {
      const perLine = Math.floor((topicW * 28.35) / size); // 한글 한 글자 폭 ≈ 글자 크기(pt)
      const lines = Math.max(1, Math.ceil(topicText(s).length / perLine));
      return h + Math.max(minRow, (lines * size * 1.25) / 28.35 + 0.15);
    }, 0.8);
  const [fontSize, rowH] = ([[11, 0.75], [10, 0.65], [9.5, 0.6], [9, 0.55], [8.5, 0.5], [8, 0.48]] as const).find(([f, r]) => fit(f, r) <= 23) ?? [8, 0.48];
  const head = ["단원명", "학습주제", "차시", "비고"].map((t, i) => cell([para(t, { font: HEAD, bold: true, align: AlignmentType.CENTER, size: fontSize })], { width: widths[i], fill: color.fill, borders: b }));
  const rows = slots.map((s, i) => {
    const firstOfUnit = i === 0 || slots[i - 1].unitIndex !== s.unitIndex;
    const lastOfUnit = i === slots.length - 1 || slots[i + 1].unitIndex !== s.unitIndex;
    const cb = { ...b, top: firstOfUnit ? b.top : dotted, bottom: lastOfUnit ? b.bottom : dotted };
    const unitCell = cell(firstOfUnit ? [para(unitTitle(s.unitName, s.unitIndex), { align: AlignmentType.CENTER, size: fontSize })] : [], {
      width: widths[0],
      vMerge: firstOfUnit ? "restart" : "continue",
      borders: { ...b, top: b.top, bottom: b.bottom },
    });
    return row(
      [
        unitCell,
        cell([para(topicText(s), { size: fontSize })], { width: widths[1], borders: cb }),
        cell([para(slotLabel(s.no, doc), { align: AlignmentType.CENTER, size: fontSize })], { width: widths[2], borders: cb }),
        cell([], { width: widths[3], borders: cb }),
      ],
      rowH,
    );
  });
  return [
    para(`${doc.basic.grade}학년 ‘${doc.basic.name}’ ${kind} 차시별 학습 주제`, { font: HEAD, bold: true, size: 16, align: AlignmentType.CENTER, after: 6 }),
    para(doc.application.schoolName || "", { font: HEAD, bold: true, align: AlignmentType.RIGHT, after: 6 }),
    table([row(head, 0.8), ...rows], widths),
  ];
}

/** 활동지 묶음 (.docx). nos: 넣을 차시 번호 (없으면 만든 활동지 전부) */
export function buildWorksheetDocx(doc: DesignDoc, nos?: number[]): Document {
  const sheets = (doc.worksheets?.sheets ?? []).filter((s) => !nos || nos.includes(s.no)).sort((a, b) => a.no - b.no);
  const children: (Paragraph | Table)[] = [...topicTable(doc, sheets.map((s) => s.no))];
  sheets.forEach((s) => children.push(...sheetChildren(doc, s, false)));
  return new Document({
    styles: { default: { document: { run: { font: BODY, size: 22 } } } },
    sections: [
      {
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: cm(1.5), bottom: cm(1.2), left: cm(1.5), right: cm(1.5) } } },
        children,
      },
    ],
  });
}
