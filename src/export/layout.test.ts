import { describe, expect, it } from "vitest";
import { lineCount, linesHeight, PAGE_BODY_PT, textEm } from "./layout";

describe("쪽 나눔용 글 높이 어림", () => {
  it("한글은 1, 영문·숫자는 약 0.55 폭", () => {
    expect(textEm("가나")).toBe(2);
    expect(textEm("ab")).toBeCloseTo(1.1);
  });
  it("칸 폭에 맞춰 줄 수를 센다 (문단마다 최소 1줄)", () => {
    // 폭 2000twips(100pt) - 여백 5pt = 95pt, 10pt 글자 → 한 줄에 9.5자
    expect(lineCount("가".repeat(9), 2000, 10)).toBe(1);
    expect(lineCount("가".repeat(10), 2000, 10)).toBe(2);
    expect(lineCount("가\n나", 2000, 10)).toBe(2);
    expect(linesHeight(2, 10)).toBeCloseTo(26);
  });
  it("A4 본문 높이", () => {
    expect(Math.round(PAGE_BODY_PT)).toBe(709);
  });
});
