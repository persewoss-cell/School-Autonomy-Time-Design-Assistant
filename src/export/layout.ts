/**
 * .docx 쪽 나눔을 정하려고 글의 높이를 '대략' 어림한다 (실제 글꼴 측정 없이 글자 수로).
 * - 한글·한자 등 넓은 글자는 글자 크기만큼, 영문·숫자·기호는 그 절반 정도 폭으로 본다.
 * - 어림이라 조금 틀릴 수 있다: 결과는 '한 쪽에 들어갈까?' 판단과 묶음 크기 결정에만 쓴다.
 */

/** A4 세로, 위 25mm·아래 22mm 여백일 때 본문 높이 (pt) */
export const PAGE_BODY_PT = (16838 - 1417 - 1247) / 20;

const wide = (ch: string) => /[ᄀ-ᇿ　-鿿가-힯＀-￯]/.test(ch);

/** 글의 폭 (글자 크기 1pt 기준) */
export function textEm(text: string): number {
  let w = 0;
  for (const ch of text) w += wide(ch) ? 1 : 0.55;
  return w;
}

/** 폭 widthTwips 칸에 size pt 글을 쓸 때 줄 수 (문단마다 따로) */
export function lineCount(text: string, widthTwips: number, size: number, padPt = 5): number {
  const perLine = Math.max(1, (widthTwips / 20 - padPt) / size);
  return text.split("\n").reduce((n, p) => n + Math.max(1, Math.ceil(textEm(p) / perLine)), 0);
}

/** 줄 수 → 높이 (pt). line은 줄 간격 배수 */
export const linesHeight = (lines: number, size: number, line = 1) => lines * size * 1.3 * line;

/** 문단 여러 개의 높이 (pt) */
export function parasHeight(texts: string[], widthTwips: number, size: number, line = 1, gapPt = 0): number {
  return texts.reduce((h, t) => h + linesHeight(lineCount(t, widthTwips, size), size, line) + gapPt, 0);
}
