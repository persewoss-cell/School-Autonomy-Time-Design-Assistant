import {
  CREATIVE_PARTS,
  creativePartsOf,
  withCreativeParts,
  type AllocationInput,
  type AutonomyCourse,
  type BandKey,
  type CreativePart,
  type CreativeParts,
  type FourSemesters,
} from "@/validation/allocation";

/**
 * 시수 점검 '엑셀로 편성표 입력하기' (사용자 요청, 2026-11-11)
 * 앱이 만든 입력 양식(.xlsx)에 노란 칸을 채워 올리면, 교과·창체 학기별 편성 시수를 ② 편성표에 반영한다.
 * - 양식에는 숨긴 '앱정보' 시트가 있어 학년·학년도·① 과목·활동·줄 위치를 알 수 있다
 * - 다른 학년·학년도 양식, ①이 바뀐 뒤의 옛 양식, 줄을 넣거나 지운 양식은 막고 이유를 알린다
 * - 빈칸은 0으로 넣고 알리며, 글자·음수·소수는 어느 칸인지 알려 주고 반영하지 않는다
 */

export const TEMPLATE_MARKER = "학교자율시간 설계 도우미 앱 · 시수 입력 양식";
export const TEMPLATE_INFO_SHEET = "앱정보";

export interface TemplateMeta {
  marker: string;
  version: 1;
  /** 입력 시트 이름 */
  sheet: string;
  band: BandKey;
  grade: number;
  schoolYear: number;
  /** 양식을 만들 때의 ① 학교자율시간 과목·활동 */
  courses: string[];
  baseHours: Record<string, number>;
  creativeBaseHours: number;
  /** 교과·창체 영역이 있는 줄 번호 */
  rows: { subjects: Record<string, number>; creative: Partial<Record<CreativePart, number>> };
  /** 학기(0~3)별 입력 칸 열 번호 */
  cols: number[];
  /** 줄 이름이 적힌 열 (교과군·교과) — 줄을 넣거나 지웠는지 확인용 */
  labelCols: number[];
}

/** ① 과목·활동을 비교하기 쉬운 글자로 (이름·교과·학기·시수) */
export const courseSignature = (courses: AutonomyCourse[]): string[] => courses.map((c) => `${c.name.trim()}|${c.subjectKey}|${c.semester}|${c.hours}`);

/** 엑셀 칸 하나: 주소와 읽은 값 (exceljs 값 그대로) */
export interface RawCell {
  addr: string;
  value: unknown;
  /** 그 줄의 이름 칸 글자 (줄이 밀렸는지 확인) */
  label: string;
}

export interface TemplateRead {
  meta: TemplateMeta;
  subjects: Record<string, RawCell[]>;
  creative: Partial<Record<CreativePart, RawCell[]>>;
}

export type ReadResult = { ok: true; read: TemplateRead } | { ok: false; error: string };

const colLetter = (c: number) => {
  let s = "";
  for (let n = c; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

/** exceljs 값 → 화면에 보이는 글자 */
function cellText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    const o = v as { richText?: { text: string }[]; result?: unknown; text?: string };
    if (o.richText) return o.richText.map((r) => r.text).join("");
    if ("result" in o) return cellText(o.result);
    if (typeof o.text === "string") return o.text;
  }
  return String(v);
}

/** 브라우저(또는 테스트)에서 올린 파일을 읽어 앱 양식인지 확인하고 노란 칸 값을 꺼낸다 */
export async function readAllocationTemplate(data: ArrayBuffer): Promise<ReadResult> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(data);
  } catch {
    return { ok: false, error: "엑셀 파일(.xlsx)을 열지 못했어요. 앱에서 받은 입력 양식을 엑셀에서 '.xlsx'로 저장해 올려 주세요. (예전 .xls, .csv, 한셀 형식은 안 돼요)" };
  }
  const infoSheet = wb.getWorksheet(TEMPLATE_INFO_SHEET);
  let meta: TemplateMeta | null = null;
  try {
    if (infoSheet && cellText(infoSheet.getCell(1, 1).value) === TEMPLATE_MARKER) meta = JSON.parse(cellText(infoSheet.getCell(2, 1).value));
  } catch {
    meta = null;
  }
  if (!meta || meta.marker !== TEMPLATE_MARKER) {
    return {
      ok: false,
      error: "앱에서 받은 입력 양식이 아니에요. 이 화면의 '입력 양식 받기'로 받은 엑셀에 입력해 올려 주세요. ('편성표 완성본'이나 다른 엑셀, 새로 만든 파일은 읽을 수 없어요)",
    };
  }
  const ws = wb.getWorksheet(meta.sheet) ?? wb.worksheets.find((w) => w.name !== TEMPLATE_INFO_SHEET);
  if (!ws) return { ok: false, error: "입력 시트를 찾지 못했어요. 시트를 지우거나 이름을 바꾸지 말고 다시 올려 주세요." };
  const take = (row: number): RawCell[] => {
    const label = meta!.labelCols.map((c) => cellText(ws.getCell(row, c).value)).join(" ").replace(/\s+/g, " ").trim();
    return meta!.cols.map((c) => ({ addr: `${colLetter(c)}${row}`, value: ws.getCell(row, c).value, label }));
  };
  return {
    ok: true,
    read: {
      meta,
      subjects: Object.fromEntries(Object.entries(meta.rows.subjects).map(([k, r]) => [k, take(r)])),
      creative: Object.fromEntries(Object.entries(meta.rows.creative).map(([k, r]) => [k, take(r!)])) as TemplateRead["creative"],
    },
  };
}

export interface CellChange {
  /** 예: '국어 3학년 1학기' */
  where: string;
  from: number;
  to: number;
}

export type ApplyPlan =
  | {
      ok: true;
      next: AllocationInput;
      /** 지금과 달라지는 칸 */
      changes: CellChange[];
      /** 알림 (빈칸 0, 기준시수 바뀜 등) */
      notes: string[];
    }
  | { ok: false; error: string; problems: string[] };

const CREATIVE_NAME = Object.fromEntries(CREATIVE_PARTS) as Record<CreativePart, string>;

/**
 * 읽은 양식을 지금 화면(학년·학년도·①)과 맞춰 보고, ② 편성표에 넣을 새 값을 만든다 (순수 함수).
 * semLabel: 학기 번호 → '3학년 1학기' 같은 이름
 */
export function planTemplateApply(current: AllocationInput, view: { grade: number; schoolYear: number }, read: TemplateRead, semLabel: (s: number) => string): ApplyPlan {
  const m = read.meta;
  const block = (error: string, problems: string[] = []): ApplyPlan => ({ ok: false, error, problems });

  // 1) 다른 학년·학년도 양식
  if (m.grade !== view.grade || m.schoolYear !== view.schoolYear || m.band !== current.band) {
    return block(`이 양식은 ${m.schoolYear}학년도 ${m.grade}학년 화면에서 받은 것이에요. 지금 화면(${view.schoolYear}학년도 ${view.grade}학년)에는 반영할 수 없어요. 맞는 화면으로 가서 올리거나, 이 화면에서 양식을 다시 받아 주세요.`);
  }
  // 2) 양식을 받은 뒤 ① 과목·활동이 바뀜
  const now = courseSignature(current.courses);
  if (now.join("\n") !== m.courses.join("\n")) {
    const fmt = (s: string) => {
      const [name, key, sem, h] = s.split("|");
      return `「${name || "이름 없음"}」(${key}, ${semLabel(Number(sem))}, ${h}시간)`;
    };
    const gone = m.courses.filter((x) => !now.includes(x)).map((x) => `양식에만 있음: ${fmt(x)}`);
    const added = now.filter((x) => !m.courses.includes(x)).map((x) => `지금 ①에만 있음: ${fmt(x)}`);
    return block("양식을 받은 뒤 ① 학교자율시간 과목·활동이 바뀌었어요. 편성 시수가 맞지 않을 수 있어 반영하지 않았어요. 양식을 다시 받아 입력해 주세요. (지금 엑셀의 숫자는 새 양식에 옮겨 적으면 돼요)", [
      ...gone,
      ...added,
    ]);
  }
  // 3) 줄을 넣거나 지워 위치가 밀림 (줄 이름이 맞는지)
  const shifted: string[] = [];
  for (const [k, cells] of Object.entries(read.subjects)) if (!cells[0]?.label.split(" ").includes(k)) shifted.push(`${k} 줄 (${cells[0]?.addr.replace(/^[A-Z]+/, "")}행에 '${cells[0]?.label || "빈칸"}')`);
  for (const [k, cells] of Object.entries(read.creative)) if (!cells?.[0]?.label.includes(CREATIVE_NAME[k as CreativePart])) shifted.push(`${CREATIVE_NAME[k as CreativePart]} 줄`);
  if (shifted.length) return block("엑셀에서 줄을 넣거나 지운 것 같아요. 칸 위치가 달라져 반영하지 않았어요. 양식을 다시 받아, 줄·칸은 그대로 두고 노란 칸 숫자만 입력해 주세요.", shifted);

  // 4) 값 읽기: 빈칸 0, 글자·음수·소수는 막기
  const blanks: string[] = [];
  const bad: string[] = [];
  const formulas: string[] = [];
  const value = (c: RawCell, where: string): number => {
    let v = c.value;
    if (v && typeof v === "object" && "formula" in (v as object)) {
      formulas.push(`${c.addr}(${where})`);
      v = (v as { result?: unknown }).result;
    }
    if (v === null || v === undefined || (typeof v === "string" && !v.trim())) {
      blanks.push(`${c.addr}(${where})`);
      return 0;
    }
    const n = typeof v === "number" ? v : typeof v === "string" && /^\s*-?\d+(\.\d+)?\s*$/.test(v) ? Number(v) : NaN;
    if (!Number.isFinite(n)) bad.push(`${c.addr}(${where}): '${cellText(v)}' — 숫자가 아니에요`);
    else if (n < 0) bad.push(`${c.addr}(${where}): ${n} — 음수예요`);
    else if (!Number.isInteger(n)) bad.push(`${c.addr}(${where}): ${n} — 소수예요 (시수는 0 이상의 정수)`);
    else if (n > 400) bad.push(`${c.addr}(${where}): ${n} — 한 학기 시수로 너무 커요`);
    else return n;
    return 0;
  };
  const subjectHours: Record<string, FourSemesters> = {};
  for (const [k, cells] of Object.entries(read.subjects)) subjectHours[k] = cells.map((c, s) => value(c, `${k} ${semLabel(s)}`)) as FourSemesters;
  const parts = creativePartsOf(current);
  const nextParts = { ...parts } as CreativeParts;
  for (const [k, cells] of Object.entries(read.creative)) nextParts[k as CreativePart] = cells!.map((c, s) => value(c, `${CREATIVE_NAME[k as CreativePart]} ${semLabel(s)}`)) as FourSemesters;
  if (bad.length) return block(`노란 칸에 시수로 쓸 수 없는 값이 ${bad.length}칸 있어 반영하지 않았어요. 엑셀에서 고쳐 저장한 뒤 다시 올려 주세요.`, bad);

  // 5) 새 값과 바뀌는 칸
  const changes: CellChange[] = [];
  for (const [k, hours] of Object.entries(subjectHours)) hours.forEach((h, s) => {
    const before = current.subjectHours[k]?.[s] ?? 0;
    if (before !== h) changes.push({ where: `${k} ${semLabel(s)}`, from: before, to: h });
  });
  for (const k of Object.keys(read.creative) as CreativePart[]) nextParts[k].forEach((h, s) => {
    if (parts[k][s] !== h) changes.push({ where: `${CREATIVE_NAME[k]} ${semLabel(s)}`, from: parts[k][s], to: h });
  });
  const next = withCreativeParts({ ...current, subjectHours: { ...current.subjectHours, ...subjectHours } }, nextParts);

  const notes: string[] = [];
  if (blanks.length) notes.push(`빈 노란 칸 ${blanks.length}개는 0시간으로 넣어요: ${blanks.slice(0, 6).join(", ")}${blanks.length > 6 ? " 외" : ""}`);
  if (formulas.length) notes.push(`노란 칸에 수식이 ${formulas.length}개 있어, 엑셀이 마지막으로 계산한 값으로 넣어요: ${formulas.slice(0, 4).join(", ")}${formulas.length > 4 ? " 외" : ""}`);
  const baseChanged = Object.keys(m.baseHours).filter((k) => m.baseHours[k] !== current.baseHours[k]);
  if (baseChanged.length || m.creativeBaseHours !== current.creativeBaseHours)
    notes.push(`양식을 받은 뒤 앱에서 기준시수가 바뀌었어요(${[...baseChanged, ...(m.creativeBaseHours !== current.creativeBaseHours ? ["창체"] : [])].join(", ")}). 엑셀의 증감·판정은 예전 기준으로 계산된 것이니, 반영한 뒤 앱의 ③ 점검 결과를 확인해 주세요.`);
  if (!changes.length) notes.push("엑셀의 숫자가 지금 편성표와 모두 같아요. 반영해도 바뀌는 칸이 없어요.");
  return { ok: true, next, changes, notes };
}
