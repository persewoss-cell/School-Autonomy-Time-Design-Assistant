/**
 * 기존 문서에서 뽑은 글자를 AI가 읽기 좋게 줄·표 모양으로 정리한다. (순수 함수: 단위 테스트 있음)
 */

/** PDF 글자 조각 하나 (pdf.js의 textContent item에서 필요한 것만) */
export interface PdfItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * (지금 앱은 한글 hwpx만 받음. PDF 읽기는 시뮬레이션·나중을 위해 남겨 둠)
 * PDF 한 쪽의 글자 조각을 줄로 묶는다.
 * - 높이(y)가 거의 같은 조각은 한 줄, 위에서 아래로
 * - 한 줄 안에서 간격이 넓으면 표의 다른 칸으로 보고 ' | '로 나눈다
 */
export function pdfPageText(items: PdfItem[], page?: { width: number; height: number }): string {
  const parts = items.filter((i) => i.str.trim());
  if (parts.length === 0) return "";
  // 가로 종이에 두 쪽을 나란히 인쇄한 PDF(2쪽 모아 찍기): 가운데를 가로지르는 글자가 없으면 왼쪽 쪽 → 오른쪽 쪽 순서로 읽는다
  if (page && page.width > page.height) {
    const mid = page.width / 2;
    const gap = page.width * 0.02;
    const crosses = parts.some((i) => i.x < mid - gap && i.x + i.width > mid + gap);
    const left = parts.filter((i) => i.x + i.width <= mid + gap);
    const right = parts.filter((i) => i.x >= mid - gap && !left.includes(i));
    if (!crosses && left.length >= 5 && right.length >= 5) return [pdfPageText(left), pdfPageText(right)].filter(Boolean).join("\n\n");
  }
  const lines: PdfItem[][] = [];
  for (const it of [...parts].sort((a, b) => b.y - a.y || a.x - b.x)) {
    const tol = Math.max(2, (it.height || 10) * 0.4);
    const line = lines.find((l) => Math.abs(l[0].y - it.y) <= tol);
    if (line) line.push(it);
    else lines.push([it]);
  }
  return lines
    .map((line) => {
      line.sort((a, b) => a.x - b.x);
      let out = "";
      let end: number | null = null;
      for (const it of line) {
        const size = it.height || 10;
        if (end !== null) {
          const gap = it.x - end;
          out += gap > size * 1.5 ? " | " : gap > size * 0.15 ? " " : "";
        }
        out += it.str;
        end = it.x + it.width;
      }
      return out.replace(/\s+/g, " ").trim();
    })
    .filter(Boolean)
    .join("\n");
}

const decode = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&");

/**
 * hwpx 본문(Contents/section*.xml) 하나를 글자로. 문단은 줄, 표는 한 행을 '| 칸 | 칸 |' 한 줄로.
 * (브라우저·Node 모두에서 돌도록 DOM 없이 태그만 차례로 읽는다)
 */
export function hwpxSectionText(xml: string): string {
  const out: string[] = [];
  // 표 안에 있을 때: 행마다 칸 글자를 모은다 (표 속 표도 바깥 칸에 이어 붙임)
  const tables: { row: string[] | null; cell: string[] | null }[] = [];
  let para = "";
  let inText = false;
  // 한글 메모(검토 의견)는 본문이 아니므로 건너뛴다: <hp:fieldBegin type="MEMO"> … </hp:fieldBegin>
  let memoDepth = 0;
  const flushPara = () => {
    const t = para.replace(/\s+/g, " ").trim();
    para = "";
    if (!t) return;
    const tb = tables[tables.length - 1];
    if (tb?.cell) tb.cell.push(t);
    else out.push(t);
  };
  const re = /<(\/?)([a-zA-Z0-9]+:)?([a-zA-Z]+)([^>]*?)(\/?)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    if (m[6] !== undefined) {
      if (inText && memoDepth === 0) para += decode(m[6]);
      continue;
    }
    const closing = m[1] === "/";
    const name = m[3];
    const selfClose = m[5] === "/";
    if (name === "fieldBegin") {
      if (!closing && !selfClose && (memoDepth > 0 || /type="MEMO"/.test(m[4]))) memoDepth++;
      else if (closing && memoDepth > 0) memoDepth--;
      continue;
    }
    if (memoDepth > 0) continue;
    if (name === "t") {
      inText = !closing && !selfClose;
    } else if (name === "tab" && !closing) {
      para += " ";
    } else if ((name === "lineBreak" || name === "br") && !closing) {
      para += " ";
    } else if (name === "p") {
      if (closing) flushPara();
    } else if (name === "tbl") {
      if (!closing && !selfClose) {
        flushPara();
        tables.push({ row: null, cell: null });
      } else if (closing) {
        tables.pop();
      }
    } else if (name === "tr" && tables.length) {
      const tb = tables[tables.length - 1];
      if (!closing) tb.row = [];
      else if (tb.row) {
        const line = `| ${tb.row.join(" | ")} |`;
        const parent = tables[tables.length - 2];
        if (parent?.cell) parent.cell.push(line);
        else out.push(line);
        tb.row = null;
      }
    } else if (name === "tc" && tables.length) {
      const tb = tables[tables.length - 1];
      if (!closing && !selfClose) tb.cell = [];
      else if (closing && tb.cell) {
        tb.row?.push(tb.cell.join(" / "));
        tb.cell = null;
      }
    }
  }
  flushPara();
  return out.join("\n");
}

/** hwpx 안 section 파일 이름을 순서대로 (section0, section1, … section10) */
export function sortSections(names: string[]): string[] {
  const num = (n: string) => Number(n.match(/section(\d+)\.xml$/i)?.[1] ?? 0);
  return names.filter((n) => /^Contents\/section\d+\.xml$/i.test(n)).sort((a, b) => num(a) - num(b));
}
