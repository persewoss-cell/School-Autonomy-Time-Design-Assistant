import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  PageNumber,
  Paragraph,
  ShadingType,
  TabStopType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlignTable,
  WidthType,
  type IBorderOptions,
  type ISectionOptions,
} from "docx";
import { SUBJECT_GROUPS, TEACHER_PLANS, TEXTBOOK_TYPES, type DesignDoc } from "@/domain/types";
import { codeMap } from "@/domain/codes";
import { applicationTexts } from "@/domain/summary";
import { lessonLabels } from "@/validation/hours";
import { checklistResults } from "@/validation/design";

/**
 * 설계 문서 → .docx (한글에서 열림)
 * - 활동: [서식1] 활동 계획서, [서식2] 활동 교육과정, [서식6] 체크리스트
 * - 과목: [서식3] 고시 외 과목 신설 승인 신청서, [서식4] 과목 교육과정, [서식7] 체크리스트
 * 교육과정 문서는 광양중동초 예시안의 모양(글꼴·크기·기호·표 선)을 따르되, 쪽 수가 늘지 않게 줄 간격·칸 여백은 좁게 한다.
 */

/** 예시안 글꼴: 본문 휴먼명조, 제목 HY울릉도M, 성취기준 함초롬바탕, 쪽 번호 함초롬돋움 */
const BODY = "휴먼명조";
const HCR = "함초롬바탕";
const TITLE = "HY울릉도M";
const DOTUM = "함초롬돋움";
/** A4 - 좌우 여백 25.4mm (twips) */
const PAGE_WIDTH = 9026;
const GRAY = "D9D9D9";
const LIGHT = "F2F2F2";

type Align = (typeof AlignmentType)[keyof typeof AlignmentType];
interface RunOpts {
  bold?: boolean;
  /** pt */
  size?: number;
  font?: string;
  color?: string;
  shade?: string;
}
interface ParaOpts extends RunOpts {
  align?: Align;
  /** 왼쪽 들여쓰기 (pt) */
  left?: number;
  /** 첫 줄 들여쓰기 (pt), 음수면 내어쓰기 */
  first?: number;
  /** 문단 앞·뒤 간격 (pt) */
  before?: number;
  after?: number;
  /** 줄 간격 (배) */
  line?: number;
  pageBreak?: boolean;
  keepNext?: boolean;
}

const pt = (n: number) => Math.round(n * 20);
const run = (text: string, o: RunOpts = {}) =>
  new TextRun({
    text,
    bold: o.bold,
    size: o.size ? Math.round(o.size * 2) : undefined,
    font: o.font ?? BODY,
    color: o.color,
    shading: o.shade ? { type: ShadingType.CLEAR, fill: o.shade, color: "auto" } : undefined,
  });

function para(content: string | TextRun[], o: ParaOpts = {}): Paragraph {
  const indent =
    o.left || o.first
      ? { left: pt(o.left ?? 0), ...(o.first && o.first < 0 ? { hanging: pt(-o.first) } : o.first ? { firstLine: pt(o.first) } : {}) }
      : undefined;
  return new Paragraph({
    alignment: o.align ?? AlignmentType.BOTH,
    indent,
    spacing: { before: pt(o.before ?? 0), after: pt(o.after ?? 0), line: Math.round((o.line ?? 1.25) * 240) },
    pageBreakBefore: o.pageBreak,
    keepNext: o.keepNext,
    children: typeof content === "string" ? [run(content, o)] : content,
  });
}

const lines = (text: string, o: ParaOpts = {}) =>
  text.split("\n").map((t) => para(t, o));

const NONE: IBorderOptions = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const line = (size: number, style: (typeof BorderStyle)[keyof typeof BorderStyle] = BorderStyle.SINGLE, color = "000000"): IBorderOptions => ({ style, size, color });
const THIN = line(3);
const THICK = line(9);

interface CellOpts {
  span?: number;
  rows?: number;
  fill?: string;
  w?: number;
  align?: (typeof VerticalAlignTable)[keyof typeof VerticalAlignTable];
  margins?: number;
  borders?: Partial<Record<"top" | "bottom" | "left" | "right" | "diagonalDown", IBorderOptions>>;
}

function cell(children: Paragraph[], o: CellOpts = {}): TableCell {
  return new TableCell({
    children: children.length ? children : [new Paragraph("")],
    columnSpan: o.span,
    rowSpan: o.rows,
    width: o.w ? { size: o.w, type: WidthType.DXA } : undefined,
    shading: o.fill ? { type: ShadingType.CLEAR, fill: o.fill, color: "auto" } : undefined,
    verticalAlign: o.align ?? VerticalAlignTable.CENTER,
    margins: { top: o.margins ?? 30, bottom: o.margins ?? 30, left: 70, right: 70 },
    borders: o.borders,
  });
}

/** 예시안 표: 위·아래 굵은 선, 안쪽 가는 선, 바깥 세로선 없음. headerRows는 쪽이 넘어가면 반복 */
function table(rows: TableCell[][], widths: number[], o: { headerRows?: number; top?: IBorderOptions; bottom?: IBorderOptions; outer?: boolean } = {}): Table {
  const side = o.outer ? THIN : NONE;
  return new Table({
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths,
    borders: { top: o.top ?? THICK, bottom: o.bottom ?? THICK, left: side, right: side, insideHorizontal: THIN, insideVertical: THIN },
    rows: rows.map((cells, i) => new TableRow({ children: cells, tableHeader: i < (o.headerRows ?? 0), cantSplit: true })),
  });
}

/**
 * 쪽 중간에서 나뉘면 안 되는 묶음(내용 체계 표, 성취기준 표 등)을 테두리 없는 한 칸 표에 넣는다.
 * 나뉠 수 없는 행(cantSplit)이라 한글·워드 모두 묶음 전체를 다음 쪽으로 넘긴다. ('다음 문단과 함께'보다 확실함)
 */
function keepTogether(children: (Paragraph | Table)[]): Table {
  const none = { top: NONE, bottom: NONE, left: NONE, right: NONE };
  return new Table({
    width: { size: PAGE_WIDTH, type: WidthType.DXA },
    columnWidths: [PAGE_WIDTH],
    borders: { ...none, insideHorizontal: NONE, insideVertical: NONE },
    rows: [
      new TableRow({
        cantSplit: true,
        children: [new TableCell({ children: [...children, new Paragraph({ spacing: { line: 240 }, children: [] })], borders: none, margins: { top: 0, bottom: 0, left: 0, right: 0 } })],
      }),
    ],
  });
}

/** 차시 번호가 칸에서 어색하게 끊기지 않게 긴 것은 '/' 앞에서 줄을 바꾼다 (예시안: 8~10 / /29) */
const lessonLabel = (s: string) => (s.length > 6 ? s.replace("/", "\n/") : s);

const box = (checked: boolean, label: string) => `${checked ? "■" : "□"} ${label}`;
const kindOf = (doc: DesignDoc) => (doc.basic.type === "subject" ? "과목" : "활동");
const schoolOf = (doc: DesignDoc) => doc.application.schoolName.trim() || "○○초등학교";
const paras = (text: string) =>
  text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

// ───────────── 계획서(서식1) / 신청서(서식3) ─────────────
function applicationForm(doc: DesignDoc): (Paragraph | Table)[] {
  const subject = doc.basic.type === "subject";
  const a = doc.application;
  const t = applicationTexts(doc);
  // 왼쪽 제목 칸을 좁게 해서 한 쪽에 들어가게
  const w = [620, 820, 4226, 900, 2460];
  const f = { size: 9, line: 1.1 };
  const head = (s: string, o: CellOpts = {}) => cell(lines(s, { ...f, bold: true, align: AlignmentType.CENTER }), { fill: LIGHT, margins: 20, ...o });
  const body = (s: string, o: CellOpts = {}) => cell(lines(s, { ...f, align: AlignmentType.LEFT }), { margins: 20, ...o });
  const groups = SUBJECT_GROUPS.map((g) => box(g === doc.basic.subjectGroup, g)).join("  ");
  const textbooks = TEXTBOOK_TYPES[doc.basic.type].map((x) => box(a.textbookType === x, x)).join("   ");
  const teachers = TEACHER_PLANS.map((x) => box(a.teacherPlans.includes(x), x)).join("\n");

  const rows: TableCell[][] = [];
  if (subject) {
    rows.push([head("학교명(기관명)", { span: 2 }), body(schoolOf(doc)), head("설립 구분"), body(["국립", "공립", "사립", "기관"].map((x) => box(a.establishment === x, x)).join("  "))]);
    rows.push([head("과목명", { span: 2 }), body(`한글명: ${doc.basic.name}\n영문명: ${a.englishName}`, { span: 3 })]);
  } else {
    rows.push([head("활동명", { span: 2 }), body(doc.basic.name, { span: 3 })]);
  }
  rows.push([head("편성\n교과(군)", { span: 2 }), body(groups, { span: 3 })]);
  rows.push([head("지도 대상/학기", { span: 2 }), body(`( ${doc.basic.grade} 학년) / ( ${doc.basic.semester} 학기)`), head("운영 시수"), cell(lines(`${doc.basic.hours} 시간`, { ...f, align: AlignmentType.CENTER }))]);
  rows.push([head(kindOf(doc), { rows: 3 }), head("개설\n필요성"), body(t.necessity, { span: 3 })]);
  rows.push([head("목표"), body(t.goal, { span: 3 })]);
  rows.push([head("내용"), body(t.content, { span: 3 })]);
  rows.push([head("교재\n활용\n계획", { rows: 2 }), head("구분"), body(textbooks, { span: 3 })]);
  rows.push([head("교재/자료명"), body(a.textbookName, { span: 3 })]);
  rows.push([head("관련 교육과정", { span: 2 }), body("2022 개정 교육과정", { span: 3 })]);
  rows.push([head("적용 기간", { span: 2 }), body(`${a.startYear || "○○○○"}학년도부터 (해당 교육과정 종료시) 까지`, { span: 3 })]);
  rows.push([head("지도교사\n확보방안", { span: 2 }), body(teachers, { span: 3 })]);
  rows.push([head("기타 특이사항", { span: 2 }), body(a.etc, { span: 3 })]);

  return [
    para(subject ? "[서식3]" : "[서식1]", { size: 9, line: 1, after: 2 }),
    formTitle(subject ? "고시 외 과목 신설 승인 신청서【초등학교용】" : "학교자율시간 활동 계획서"),
    table(rows, w),
    para(
      subject ? "위와 같이 과목을 개설･운영하고자 하오니 승인하여 주시기 바랍니다." : "학교자율시간 설계･운영 지침에 의거, 위와 같이 활동을 계획하여 운영하고자 합니다.",
      { size: 10, align: AlignmentType.CENTER, before: 6, after: 4, keepNext: true },
    ),
    para(`붙임 1. (${doc.basic.name}) ${subject ? "교육과정" : "활동 세부 지도계획안"} 1부.`, { size: 9.5, line: 1.1, align: AlignmentType.LEFT, keepNext: true }),
    para(`       2. (${doc.basic.grade})학년 교육과정 편성표 1부.`, { size: 9.5, line: 1.1, align: AlignmentType.LEFT, keepNext: true }),
    para("년      월      일", { size: 10, line: 1.1, align: AlignmentType.CENTER, before: 4, keepNext: true }),
    para(`${schoolOf(doc)}장  ${subject ? "(직인)" : "(직인 생략)"}`, { size: 10, line: 1.1, bold: true, align: AlignmentType.RIGHT, before: 4, keepNext: true }),
    para(subject ? "전남광주통합특별시교육감 귀하" : `${schoolOf(doc)}운영위원장 귀하`, { size: 11, line: 1.1, bold: true, align: AlignmentType.LEFT, before: 6 }),
  ];
}

/** 서식 제목: 테두리 상자 */
const formTitle = (text: string) =>
  table([[cell([para(text, { size: 15, bold: true, align: AlignmentType.CENTER, line: 1.1 })], { margins: 60 })]], [PAGE_WIDTH], { top: THIN, bottom: THIN, outer: true });

// ───────────── 교육과정 문서(서식2 / 서식4) — 예시안 모양 ─────────────
/** 제목 띠: 회색 칸에 「과목명」(HY울릉도M 21pt), 과목은 오른쪽에 개설 형태 꼬리표 */
function banner(doc: DesignDoc, pageBreak: boolean): (Paragraph | Table)[] {
  const subject = doc.basic.type === "subject";
  const noBorder = { top: NONE, bottom: NONE, left: NONE, right: NONE };
  const titleCell = cell([para(`「${doc.basic.name}」`, { font: TITLE, size: 21, align: AlignmentType.CENTER, line: 1.2 })], { fill: "DCDCDC", borders: noBorder, margins: 50 });
  const badge = subject
    ? [cell([para([run(` ${doc.basic.openingType.replace(/\s/g, "")} `, { font: TITLE, size: 12, color: "FFFFFF", shade: "595959" })], { align: AlignmentType.RIGHT, line: 1.2 })], { fill: "DCDCDC", borders: noBorder, align: VerticalAlignTable.BOTTOM })]
    : [];
  return [
    ...(pageBreak ? [para("", { pageBreak: true, line: 1 })] : []),
    table([[titleCell, ...badge]], subject ? [PAGE_WIDTH - 2200, 2200] : [PAGE_WIDTH], { top: NONE, bottom: NONE }),
    // 왼쪽 '학교자율시간 [과목]', 오른쪽 끝 '학교명 학년 학기' (오른쪽 탭)
    new Paragraph({
      tabStops: [{ type: TabStopType.RIGHT, position: PAGE_WIDTH - pt(6) }],
      indent: { left: pt(6) },
      spacing: { before: pt(6), after: pt(14) },
      children: [run(`학교자율시간 [${kindOf(doc)}]`, { size: 11, bold: true }), run(`\t${schoolOf(doc)} ${doc.basic.grade}학년 ${doc.basic.semester}학기`, { size: 11, bold: true })],
    }),
  ];
}

/** 큰 제목: 회색 바탕 13pt. 표가 아닌 문단이라 '다음 문단과 함께'가 잘 지켜져 쪽 끝에 제목만 남지 않는다 */
const h1 = (text: string, pageBreak = false): (Paragraph | Table)[] => [
  new Paragraph({
    pageBreakBefore: pageBreak,
    keepNext: true,
    shading: { type: ShadingType.CLEAR, fill: "E1E1E1", color: "auto" },
    indent: { left: pt(2), right: Math.round(PAGE_WIDTH * 0.08) },
    spacing: { before: pt(4), after: pt(8), line: 300 },
    children: [run(` ${text}`, { size: 13 })],
  }),
];
const h2 = (text: string, pageBreak = false) => para(text, { size: 12, align: AlignmentType.LEFT, before: pageBreak ? 0 : 10, after: 4, pageBreak, keepNext: true });
const spacer = (n = 14) => para("", { size: 4, line: 1, after: n });

function ideasTable(doc: DesignDoc): Table {
  const ideas = doc.coreIdeas.filter((s) => s.trim());
  return table(
    [
      [cell([para("핵심아이디어", { size: 10.5, bold: true, align: AlignmentType.CENTER, font: DOTUM, keepNext: true })], { fill: GRAY, borders: { bottom: line(4, BorderStyle.DASHED) } })],
      [cell(ideas.map((s) => para(`·${s}`, { size: 9.5, left: 8, first: -8, line: 1.15, keepNext: true })), { borders: { top: line(4, BorderStyle.DASHED) } })],
    ],
    [PAGE_WIDTH],
    { top: line(9, BorderStyle.SINGLE, "404040"), bottom: NONE },
  );
}

function contentTable(doc: DesignDoc): Table {
  const subject = doc.basic.type === "subject";
  const n = Math.max(1, doc.areas.length);
  const labelW = subject ? 820 : 1400;
  const areaW = Math.floor((PAGE_WIDTH - labelW) / n);
  const widths = [labelW, ...doc.areas.map(() => areaW)];
  // 내용 체계 표가 쪽 중간에서 나뉘지 않도록 모든 문단에 '다음 문단과 함께'
  const th = (s: string, o: CellOpts = {}) => cell(lines(s, { size: 11, bold: true, align: AlignmentType.CENTER, line: 1.1, keepNext: true }), { fill: GRAY, ...o });
  const items = (xs: string[]) =>
    xs
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => para(`·${s}`, { size: 10.5, align: AlignmentType.LEFT, line: 1.25, keepNext: true }));
  const catLabel = (s: string) => (subject ? s.split("·").join("\n‧\n") : s);
  const corner = subject
    ? cell([para("영역", { size: 11, bold: true, align: AlignmentType.RIGHT, keepNext: true }), para("", { keepNext: true }), para("범주", { size: 11, bold: true, align: AlignmentType.LEFT, keepNext: true })], {
        fill: GRAY,
        rows: 2,
        borders: { diagonalDown: THIN },
      })
    : th("범주", { rows: 2 });
  const cats = [
    ["지식·이해", "knowledge"],
    ["과정·기능", "process"],
    ["가치·태도", "values"],
  ] as const;
  return table(
    [
      [corner, th("내용 요소", { span: n })],
      doc.areas.map((a, i) => th(`(${i + 1}) ${a.name}`)),
      ...cats.map(([lab, key]) => [th(catLabel(lab)), ...doc.areas.map((a) => cell(items(a[key]), { margins: 50 }))]),
    ],
    widths,
    { top: line(4), bottom: THIN },
  );
}

function standardsBlock(doc: DesignDoc): (Paragraph | Table)[] {
  const codes = codeMap(doc);
  if (doc.basic.type === "subject") {
    const dotted = line(4, BorderStyle.DOTTED);
    return doc.areas.map((a, i) => keepTogether([
      para(`(${i + 1}) ${a.name}`, { size: 12, align: AlignmentType.LEFT, before: 6, after: 4, keepNext: true }),
      table(
        [[cell(doc.standards.filter((s) => s.areaIndex === i).map((s) => para(`${codes.get(s.id) ?? ""} ${s.text}`, { font: HCR, size: 10, left: 74, first: -74, line: 1.3, keepNext: true })), { margins: 40, borders: { left: dotted, right: dotted } })]],
        [PAGE_WIDTH],
        { top: dotted, bottom: dotted, outer: false },
      ),
    ]));
  }
  return [
    table(
      doc.standards.map((s) => [
        cell([para(codes.get(s.id) ?? "", { font: HCR, size: 9, align: AlignmentType.CENTER, line: 1.1 })], { fill: LIGHT }),
        cell([para(s.text, { font: HCR, size: 10, line: 1.25 })]),
      ]),
      [1700, PAGE_WIDTH - 1700],
    ),
  ];
}

function standardParas(doc: DesignDoc, ids: string[]): Paragraph[] {
  const codes = codeMap(doc);
  return ids.flatMap((id, k) => {
    const s = doc.standards.find((x) => x.id === id);
    if (!s) return [];
    return [...(k > 0 ? [para("", { size: 6, line: 1 })] : []), para(codes.get(id) ?? "", { size: 9, align: AlignmentType.CENTER, line: 1.15 }), para(s.text, { size: 9, align: AlignmentType.CENTER, line: 1.15 })];
  });
}

function unitPlanTable(doc: DesignDoc): Table | Paragraph {
  const plan = doc.plan.selected;
  if (!plan) return para("(단원 지도계획을 아직 정하지 않았습니다.)");
  const widths = [785, 1345, 785, 1020, 4251, 840];
  const th = (s: string) => cell([para(s, { size: 10.5, bold: true, align: AlignmentType.CENTER, line: 1.1 })], { fill: LIGHT, margins: 50 });
  const rows: TableCell[][] = [["단원명", "성취기준", "차시", "학습주제", "학습 내용", "비고"].map(th)];
  const labels = lessonLabels(plan.units, doc.basic.hours);
  const dotted = line(4, BorderStyle.DOTTED);
  plan.units.forEach((u, ui) => {
    u.lessons.forEach((l, li) => {
      const content = [
        para(`· ${l.goal}`, { size: 10, bold: true, left: 9, first: -9, align: AlignmentType.LEFT, line: 1.15 }),
        ...l.activities.filter((x) => x.trim()).map((x) => para(`- ${x}`, { size: 9, left: 9, first: -7, align: AlignmentType.LEFT, line: 1.15 })),
        ...(l.assessment.trim()
          ? [
              new Paragraph({
                spacing: { before: pt(2), line: Math.round(1.15 * 240) },
                border: { top: dotted, bottom: dotted, left: dotted, right: dotted },
                children: [run("[과정중심평가]", { size: 9.5, shade: "FFE7D8" }), run(` ${l.assessment}`, { size: 10 })],
              }),
            ]
          : []),
      ];
      const row: TableCell[] = [];
      if (li === 0) {
        row.push(cell(lines(`${ui + 1}단원\n${u.unitName}`, { size: 10, bold: true, align: AlignmentType.CENTER, line: 1.2 }), { rows: u.lessons.length }));
        row.push(cell(standardParas(doc, u.standardIds), { rows: u.lessons.length }));
      }
      row.push(
        cell(lines(lessonLabel(labels[ui][li]), { size: 9.5, align: AlignmentType.CENTER, line: 1.1 })),
        cell([para(l.topic, { size: 9.5, align: AlignmentType.CENTER, line: 1.15 })]),
        cell(content, { align: VerticalAlignTable.TOP }),
        cell(lines(l.note, { size: 9, align: AlignmentType.CENTER, line: 1.15 })),
      );
      rows.push(row);
    });
  });
  return table(rows, widths, { headerRows: 1 });
}

function assessmentTable(doc: DesignDoc): Table {
  const subject = doc.basic.type === "subject";
  const widths = [840, 1445, 2058, 578, 3149, 956];
  const th = (s: string, o: CellOpts = {}) => cell(lines(s, { size: 10.5, bold: true, align: AlignmentType.CENTER, line: 1.1 }), { fill: LIGHT, margins: 50, ...o });
  const rows: TableCell[][] = [[th("시기"), th("성취기준"), th("수업·평가 방법,\n연계의 주안점"), th(subject ? "성취수준" : "평가 기준", { span: 2 }), th("방법")]];
  for (const a of doc.assessments) {
    (["A", "B", "C"] as const).forEach((lv, k) => {
      const row: TableCell[] = [];
      if (k === 0) {
        row.push(
          cell([para(a.month, { size: 10, align: AlignmentType.CENTER })], { rows: 3 }),
          cell(standardParas(doc, a.standardIds), { rows: 3 }),
          cell(lines(a.focus, { size: 9.5, align: AlignmentType.LEFT, line: 1.2 }), { rows: 3 }),
        );
      }
      row.push(cell([para(lv, { size: 9.5, align: AlignmentType.CENTER })]), cell([para(a.levels[lv], { size: 9.5, line: 1.15 })]));
      if (k === 0) row.push(cell(a.methods.map((m) => para(m, { size: 9.5, align: AlignmentType.CENTER, line: 1.3 })), { rows: 3 }));
      rows.push(row);
    });
  }
  return table(rows, widths, { headerRows: 1 });
}

const numbered = (items: string[]) =>
  items.filter((s) => s.trim()).map((s, i) => para(`(${i + 1}) ${s}`, { left: 25, first: -25, line: 1.3, after: 2 }));

function curriculumDoc(doc: DesignDoc): (Paragraph | Table)[] {
  const subject = doc.basic.type === "subject";
  const out: (Paragraph | Table)[] = [para(subject ? "[서식4]" : "[서식2]", { size: 9, line: 1, pageBreak: true, after: 2 }), ...banner(doc, false)];
  const rationale = paras(doc.intro.rationale).map((s) => para(s, { first: 9 }));
  const goals = doc.intro.detailGoals.filter((g) => g.trim());
  let n = 1;
  if (subject) {
    out.push(...h1(`${n++}. 성격`), ...rationale, spacer());
    out.push(...h1(`${n++}. 목표`), para(doc.intro.overallGoal, { after: 6 }), ...goals.map((g, i) => para(`(${i + 1}) ${g}`, { left: 34, first: -20 })), spacer());
  } else {
    out.push(...h1(`${n++}. 필요성 및 목표`), ...rationale, para(doc.intro.overallGoal, { first: 9, before: 6 }), ...goals.map((g) => para(`·${g}`)), spacer());
  }
  out.push(...h1(`${n++}. 내용 체계`), keepTogether([ideasTable(doc), para("", { size: 4, line: 1, after: 4 }), contentTable(doc)]), spacer());
  out.push(...h1(`${n++}. 성취기준`), ...(doc.basic.type === "subject" ? standardsBlock(doc) : [keepTogether(standardsBlock(doc))]), spacer());
  if (subject) {
    // 쪽 수를 줄이려고 억지 쪽 나눔은 하지 않는다 (표 머리줄은 쪽마다 반복)
    const t = doc.teaching;
    out.push(spacer(), ...h1(`${n++}. 교수‧학습 방향 및 방법`));
    out.push(h2("가. 교수·학습의 방향"), ...numbered(t.teachingDirection));
    out.push(h2("나. 교수·학습의 방법"), ...numbered(t.teachingMethods));
    out.push(h2("다. 단원 지도 계획"), unitPlanTable(doc));
    out.push(spacer(), ...h1(`${n++}. 평가 방향 및 방법`));
    out.push(h2("가. 평가의 방향"), ...numbered(t.assessDirection));
    out.push(h2("나. 평가의 방법"), ...numbered(t.assessMethods));
    out.push(h2("다. 평가 계획"), assessmentTable(doc));
  } else {
    out.push(...h1(`${n++}. 지도의 실제`));
    out.push(h2("가. 단원 지도계획"), unitPlanTable(doc));
    out.push(h2("나. 평가 계획"), assessmentTable(doc));
  }
  return out;
}

// ───────────── 체크리스트(서식6 / 서식7) ─────────────
function checklistDoc(doc: DesignDoc): (Paragraph | Table)[] {
  const subject = doc.basic.type === "subject";
  const results = checklistResults(doc);
  const widths = [1400, 6626, 1000];
  const f = { size: 9.5, line: 1.1 };
  const rows: TableCell[][] = [["영역", "평가 지표", "검토 결과\n(○, X)"].map((h) => cell(lines(h, { ...f, bold: true, align: AlignmentType.CENTER }), { fill: LIGHT }))];
  const areas = [...new Set(results.map((r) => r.area))];
  for (const area of areas) {
    const items = results.filter((r) => r.area === area);
    items.forEach((r, i) => {
      const row: TableCell[] = [];
      if (i === 0) row.push(cell([para(area, { ...f, bold: true, align: AlignmentType.CENTER })], { rows: items.length, fill: LIGHT }));
      row.push(cell([para(`∘ ${r.label}`, { ...f, align: AlignmentType.LEFT })]), cell([para(r.ok ? "○" : "X", { ...f, align: AlignmentType.CENTER })]));
      rows.push(row);
    });
  }
  return [
    para(subject ? "[서식7]" : "[서식6]", { size: 9, line: 1, pageBreak: true, after: 2 }),
    formTitle(`학교자율시간 「${kindOf(doc)}」 개설 체크리스트`),
    para(`${kindOf(doc)}명: ${doc.basic.name} (${doc.basic.grade}학년 ${doc.basic.semester}학기, ${doc.basic.hours}시간)`, { size: 10, line: 1.1, before: 4, after: 4, align: AlignmentType.LEFT }),
    table(rows, widths, { headerRows: 1 }),
  ];
}

export function buildDesignDocx(doc: DesignDoc): Document {
  const footer = new Footer({
    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: ["- ", PageNumber.CURRENT, " -"], font: DOTUM, size: 20 })] })],
  });
  const section: ISectionOptions = {
    properties: {
      page: {
        size: { width: 11906, height: 16838 },
        // 위 25mm, 아래 22mm, 좌우 25.4mm (예시안)
        margin: { top: 1417, bottom: 1247, left: 1440, right: 1440, footer: 567 },
      },
    },
    footers: { default: footer },
    children: [...applicationForm(doc), ...curriculumDoc(doc), ...checklistDoc(doc)],
  };
  return new Document({
    creator: "학교자율시간 설계 도우미 앱",
    title: `${doc.basic.name} 학교자율시간 ${kindOf(doc)}`,
    styles: {
      default: { document: { run: { font: BODY, size: 24 }, paragraph: { spacing: { line: 300 } } } },
    },
    sections: [section],
  });
}

export function docxFileName(doc: DesignDoc): string {
  const safe = (doc.basic.name || "이름없음").replace(/[\\/:*?"<>|]/g, "");
  return `${safe}_학교자율시간_${kindOf(doc)}_${doc.basic.grade}학년${doc.basic.semester}학기.docx`;
}
