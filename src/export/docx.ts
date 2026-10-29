import {
  AlignmentType,
  BorderStyle,
  Document,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlignTable,
  WidthType,
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
 * 양식은 「2027학년도 초등 학교자율시간 설계·운영 지침」 서식과 예시 문서를 따른다.
 */

const FONT = "맑은 고딕";
const PAGE_WIDTH = 9638; // A4 - 좌우 여백 각 15mm (twips)
const GRAY = "E8EFEB";

type CellContent = string | Paragraph[];

const lines = (text: string, opts: { bold?: boolean; size?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}) =>
  text.split("\n").map(
    (t) =>
      new Paragraph({
        alignment: opts.align,
        spacing: { after: 40 },
        children: [new TextRun({ text: t, bold: opts.bold, size: opts.size, font: FONT })],
      }),
  );

const para = (text: string, opts: { bold?: boolean; size?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; indent?: number; before?: number; after?: number; pageBreak?: boolean } = {}) =>
  new Paragraph({
    alignment: opts.align,
    indent: opts.indent ? { left: opts.indent } : undefined,
    spacing: { before: opts.before ?? 0, after: opts.after ?? 80 },
    pageBreakBefore: opts.pageBreak,
    children: [new TextRun({ text, bold: opts.bold, size: opts.size, font: FONT })],
  });

const heading = (text: string, pageBreak = false) => para(text, { bold: true, size: 24, before: 240, after: 120, pageBreak });
const subheading = (text: string) => para(text, { bold: true, size: 21, before: 160, after: 80 });
const title = (text: string, pageBreak = false) => para(text, { bold: true, size: 32, align: AlignmentType.CENTER, after: 240, pageBreak });

function cell(
  content: CellContent,
  o: { w?: number; span?: number; rows?: number; head?: boolean; center?: boolean } = {},
): TableCell {
  const children = typeof content === "string" ? lines(content, { bold: o.head, align: o.center || o.head ? AlignmentType.CENTER : undefined }) : content;
  return new TableCell({
    children: children.length ? children : [new Paragraph("")],
    columnSpan: o.span,
    rowSpan: o.rows,
    width: o.w ? { size: o.w, type: WidthType.DXA } : undefined,
    shading: o.head ? { type: ShadingType.CLEAR, fill: GRAY, color: "auto" } : undefined,
    verticalAlign: VerticalAlignTable.CENTER,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
  });
}

const border = { style: BorderStyle.SINGLE, size: 4, color: "555555" };
/** headerRows: 쪽이 넘어가면 반복할 머리글 행 수 */
function table(rows: TableCell[][], widths: number[], headerRows = 0): Table {
  return new Table({
    width: { size: PAGE_WIDTH, type: WidthType.DXA },
    columnWidths: widths,
    borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
    rows: rows.map((cells, i) => new TableRow({ children: cells, tableHeader: i < headerRows, cantSplit: i < headerRows })),
  });
}

const box = (checked: boolean, label: string) => `${checked ? "■" : "□"} ${label}`;
const kindOf = (doc: DesignDoc) => (doc.basic.type === "subject" ? "과목" : "활동");
const schoolOrDefault = (doc: DesignDoc) => doc.application.schoolName.trim() || "○○초등학교";

// ───────────── 계획서(서식1) / 신청서(서식3) ─────────────
function applicationForm(doc: DesignDoc): (Paragraph | Table)[] {
  const subject = doc.basic.type === "subject";
  const a = doc.application;
  const t = applicationTexts(doc);
  const w = [1300, 1500, 3438, 1500, 1900];
  const groups = SUBJECT_GROUPS.map((g) => box(g === doc.basic.subjectGroup, g)).join("  ");
  const textbooks = TEXTBOOK_TYPES[doc.basic.type].map((x) => box(a.textbookType === x, x)).join("\n");
  const teachers = TEACHER_PLANS.map((x) => box(a.teacherPlans.includes(x), x)).join("\n");

  const rows: TableCell[][] = [];
  if (subject) {
    rows.push([
      cell("학교명(기관명)", { head: true, span: 2 }),
      cell(schoolOrDefault(doc)),
      cell("설립 구분", { head: true }),
      cell(["국립", "공립", "사립", "기관"].map((x) => box(a.establishment === x, x)).join(" ")),
    ]);
    rows.push([cell("과목명", { head: true, span: 2 }), cell(`한글명: ${doc.basic.name}\n영문명: ${a.englishName}`, { span: 3 })]);
  } else {
    rows.push([cell("활동명", { head: true, span: 2 }), cell(doc.basic.name, { span: 3 })]);
  }
  rows.push([cell("편성 교과(군)", { head: true, span: 2 }), cell(groups, { span: 3 })]);
  rows.push([
    cell("지도 대상/학기", { head: true, span: 2 }),
    cell(`( ${doc.basic.grade} 학년) / ( ${doc.basic.semester} 학기)`),
    cell("운영 시수", { head: true }),
    cell(`${doc.basic.hours} 시간`, { center: true }),
  ]);
  rows.push([cell(kindOf(doc), { head: true, rows: 3 }), cell("개설\n필요성", { head: true }), cell(t.necessity, { span: 3 })]);
  rows.push([cell("목표", { head: true }), cell(t.goal, { span: 3 })]);
  rows.push([cell("내용", { head: true }), cell(t.content, { span: 3 })]);
  rows.push([cell("교재\n활용\n계획", { head: true, rows: 2 }), cell("구분", { head: true }), cell(textbooks, { span: 3 })]);
  rows.push([cell("교재/자료명", { head: true }), cell(a.textbookName, { span: 3 })]);
  rows.push([cell("관련 교육과정", { head: true, span: 2 }), cell("2022 개정 교육과정", { span: 3 })]);
  rows.push([cell("적용 기간", { head: true, span: 2 }), cell(`${a.startYear || "○○○○"}학년도부터 (해당 교육과정 종료시) 까지`, { span: 3 })]);
  rows.push([cell("지도교사\n확보방안", { head: true, span: 2 }), cell(teachers, { span: 3 })]);
  rows.push([cell("기타 특이사항", { head: true, span: 2 }), cell(a.etc, { span: 3 })]);

  const out: (Paragraph | Table)[] = [
    para(subject ? "[서식3]" : "[서식1]", { size: 18 }),
    title(subject ? "고시 외 과목 신설 승인 신청서【초등학교용】" : "학교자율시간 활동 계획서"),
    table(rows, w),
    para("", { after: 120 }),
    para(
      subject
        ? "위와 같이 과목을 개설･운영하고자 하오니 승인하여 주시기 바랍니다."
        : "학교자율시간 설계･운영 지침에 의거, 위와 같이 활동을 계획하여 운영하고자 합니다.",
      { align: AlignmentType.CENTER, before: 200, after: 200 },
    ),
    para(subject ? `붙임  1. (${doc.basic.name}) 교육과정 1부.` : `붙임  1. (${doc.basic.name}) 활동 세부 지도계획안 1부.`, { indent: 400 }),
    para(`        2. (${doc.basic.grade})학년 교육과정 편성표 1부.`, { indent: 400 }),
    para("년      월      일", { align: AlignmentType.CENTER, before: 300, after: 200 }),
    para(`${schoolOrDefault(doc)}장  ${subject ? "(직인)" : "(직인 생략)"}`, { align: AlignmentType.RIGHT, bold: true, after: 200 }),
    para(subject ? "전남광주통합특별시교육감 귀하" : `${schoolOrDefault(doc)}운영위원장 귀하`, { bold: true, size: 24 }),
  ];
  return out;
}

// ───────────── 교육과정 문서(서식2 / 서식4) ─────────────
function contentSystemTable(doc: DesignDoc): Table {
  const n = Math.max(1, doc.areas.length);
  const labelW = 1400;
  const areaW = Math.floor((PAGE_WIDTH - labelW) / n);
  const widths = [labelW, ...doc.areas.map(() => areaW)];
  const bullet = (xs: string[]) => xs.map((s) => s.trim()).filter(Boolean).map((s) => `· ${s}`).join("\n");
  return table(
    [
      [cell("핵심아이디어", { head: true, span: n + 1 })],
      [cell(doc.coreIdeas.filter((s) => s.trim()).map((s) => `⋅${s}`).join("\n"), { span: n + 1 })],
      [cell("범주", { head: true, rows: 2 }), cell("내용 요소", { head: true, span: n })],
      doc.areas.map((a, i) => cell(`(${i + 1}) ${a.name}`, { head: true })),
      [cell("지식·이해", { head: true }), ...doc.areas.map((a) => cell(bullet(a.knowledge)))],
      [cell("과정·기능", { head: true }), ...doc.areas.map((a) => cell(bullet(a.process)))],
      [cell("가치·태도", { head: true }), ...doc.areas.map((a) => cell(bullet(a.values)))],
    ],
    widths,
  );
}

function unitPlanTable(doc: DesignDoc): Table {
  const plan = doc.plan.selected;
  const codes = codeMap(doc);
  const widths = [1100, 1900, 1100, 1500, 3038, 1000];
  const rows: TableCell[][] = [["단원명", "성취기준", "차시", "학습주제", "학습 내용", "비고"].map((h) => cell(h, { head: true }))];
  if (plan) {
    const labels = lessonLabels(plan.units, doc.basic.hours);
    plan.units.forEach((u, ui) => {
      const stdText = u.standardIds
        .map((id) => {
          const s = doc.standards.find((x) => x.id === id);
          return s ? `${codes.get(id)}\n${s.text}` : "";
        })
        .filter(Boolean)
        .join("\n\n");
      u.lessons.forEach((l, li) => {
        const content = [
          `· ${l.goal}`,
          ...l.activities.filter((x) => x.trim()).map((x) => `- ${x}`),
          ...(l.assessment.trim() ? [`[과정중심평가] ${l.assessment}`] : []),
        ].join("\n");
        const row: TableCell[] = [];
        if (li === 0) {
          row.push(cell(`${ui + 1}단원\n${u.unitName}`, { rows: u.lessons.length, center: true }));
          row.push(cell(stdText, { rows: u.lessons.length }));
        }
        row.push(cell(labels[ui][li], { center: true }), cell(l.topic, { center: true }), cell(content), cell(l.note, { center: true }));
        rows.push(row);
      });
    });
  }
  return table(rows, widths, 1);
}

function assessmentTable(doc: DesignDoc): Table {
  const codes = codeMap(doc);
  const widths = [800, 1900, 2600, 500, 2638, 1200];
  const rows: TableCell[][] = [["시기", "성취기준", "수업·평가 방법,\n연계의 주안점", "성취수준", "", "방법"].map((h, i) => (i === 3 ? cell(h, { head: true, span: 2 }) : i === 4 ? null : cell(h, { head: true }))).filter((c): c is TableCell => c !== null)];
  for (const a of doc.assessments) {
    const std = a.standardIds
      .map((id) => {
        const s = doc.standards.find((x) => x.id === id);
        return s ? `${codes.get(id)}\n${s.text}` : "";
      })
      .filter(Boolean)
      .join("\n\n");
    (["A", "B", "C"] as const).forEach((lv, k) => {
      const row: TableCell[] = [];
      if (k === 0) {
        row.push(cell(a.month, { rows: 3, center: true }), cell(std, { rows: 3 }), cell(a.focus, { rows: 3 }));
      }
      row.push(cell(lv, { center: true }), cell(a.levels[lv]));
      if (k === 0) row.push(cell(a.methods.join("\n"), { rows: 3, center: true }));
      rows.push(row);
    });
  }
  return table(rows, widths, 1);
}

const numbered = (items: string[]) => items.filter((s) => s.trim()).map((s, i) => para(`(${i + 1}) ${s}`, { indent: 300 }));

function curriculumDoc(doc: DesignDoc): (Paragraph | Table)[] {
  const subject = doc.basic.type === "subject";
  const codes = codeMap(doc);
  const out: (Paragraph | Table)[] = [
    para(subject ? "[서식4]" : "[서식2]", { size: 18, pageBreak: true }),
    title(`「${doc.basic.name}」`),
    para(`학교자율시간 [${kindOf(doc)}]   ${doc.basic.openingType}   ${schoolOrDefault(doc)} ${doc.basic.grade}학년 ${doc.basic.semester}학기`, {
      align: AlignmentType.CENTER,
      after: 240,
    }),
  ];
  let n = 1;
  const goalBlock = () => [
    para(doc.intro.overallGoal, { indent: 200 }),
    ...doc.intro.detailGoals.filter((g) => g.trim()).map((g, i) => para(`(${i + 1}) ${g}`, { indent: 300 })),
  ];
  if (subject) {
    out.push(heading(`${n++}. 성격`), ...doc.intro.rationale.split("\n").filter((s) => s.trim()).map((s) => para(s, { indent: 200 })));
    out.push(heading(`${n++}. 목표`), ...goalBlock());
  } else {
    out.push(heading(`${n++}. 필요성 및 목표`), ...doc.intro.rationale.split("\n").filter((s) => s.trim()).map((s) => para(s, { indent: 200 })), ...goalBlock());
  }
  out.push(heading(`${n++}. 내용 체계`), contentSystemTable(doc));
  out.push(heading(`${n++}. 성취기준`));
  doc.areas.forEach((a, i) => {
    out.push(subheading(`(${i + 1}) ${a.name}`));
    doc.standards.filter((s) => s.areaIndex === i).forEach((s) => out.push(para(`${codes.get(s.id)} ${s.text}`, { indent: 200 })));
  });
  if (subject) {
    out.push(heading(`${n++}. 교수·학습 방향 및 방법`));
    out.push(subheading("가. 교수·학습의 방향"), ...numbered(doc.teaching.teachingDirection));
    out.push(subheading("나. 교수·학습의 방법"), ...numbered(doc.teaching.teachingMethods));
    out.push(subheading("다. 단원 지도 계획"), unitPlanTable(doc));
    out.push(heading(`${n++}. 평가 방향 및 방법`));
    out.push(subheading("가. 평가의 방향"), ...numbered(doc.teaching.assessDirection));
    out.push(subheading("나. 평가의 방법"), ...numbered(doc.teaching.assessMethods));
    out.push(subheading("다. 평가 계획"), assessmentTable(doc));
  } else {
    out.push(heading(`${n++}. 지도의 실제`));
    out.push(subheading("가. 단원 지도계획"), unitPlanTable(doc));
    out.push(subheading("나. 평가 계획"), assessmentTable(doc));
  }
  return out;
}

// ───────────── 체크리스트(서식6 / 서식7) ─────────────
function checklistDoc(doc: DesignDoc): (Paragraph | Table)[] {
  const subject = doc.basic.type === "subject";
  const results = checklistResults(doc);
  const widths = [1700, 6538, 1400];
  const rows: TableCell[][] = [["영역", "평가 지표", "결과\n(○, X)"].map((h) => cell(h, { head: true }))];
  const areas = [...new Set(results.map((r) => r.area))];
  for (const area of areas) {
    const items = results.filter((r) => r.area === area);
    items.forEach((r, i) => {
      const row: TableCell[] = [];
      if (i === 0) row.push(cell(area, { head: true, rows: items.length }));
      row.push(cell(`∘ ${r.label}`), cell(r.ok ? "○" : "X", { center: true }));
      rows.push(row);
    });
  }
  return [
    para(subject ? "[서식7]" : "[서식6]", { size: 18, pageBreak: true }),
    title(`학교자율시간 「${kindOf(doc)}」 개설 체크리스트`),
    para(`${kindOf(doc)}명: ${doc.basic.name}   (${doc.basic.grade}학년 ${doc.basic.semester}학기, ${doc.basic.hours}시간)`, { after: 160 }),
    table(rows, widths, 1),
  ];
}

export function buildDesignDocx(doc: DesignDoc): Document {
  const section: ISectionOptions = {
    properties: {
      page: {
        size: { width: 11906, height: 16838 },
        margin: { top: 1134, bottom: 1134, left: 850, right: 850 },
      },
    },
    children: [...applicationForm(doc), ...curriculumDoc(doc), ...checklistDoc(doc)],
  };
  return new Document({
    creator: "학교자율시간 설계 도우미 앱",
    title: `${doc.basic.name} 학교자율시간 ${kindOf(doc)}`,
    styles: { default: { document: { run: { font: FONT, size: 20 } } } },
    sections: [section],
  });
}

export function docxFileName(doc: DesignDoc): string {
  const safe = (doc.basic.name || "이름없음").replace(/[\\/:*?"<>|]/g, "");
  return `${safe}_학교자율시간_${kindOf(doc)}_${doc.basic.grade}학년${doc.basic.semester}학기.docx`;
}
