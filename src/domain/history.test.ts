import { describe, expect, it } from "vitest";
import { diffPaths, mergeTyping, type TypingState } from "./history";

const doc = (t: string, n = 1) => ({ intro: { rationale: t }, basic: { grade: n } });

describe("되돌리기 기록 묶기", () => {
  it("달라진 곳을 찾는다", () => {
    expect(diffPaths(doc("가"), doc("가나"))).toEqual([{ path: "/intro/rationale", kind: "text", before: "가", after: "가나" }]);
    expect(diffPaths(doc("가"), doc("가", 3))[0].kind).toBe("other");
  });
  it("한 칸에 이어 치는 글은 어절(띄어쓰기) 단위로 묶는다", () => {
    let last: TypingState | null = null;
    const steps = ["우", "우리", "우리 ", "우리 마", "우리 마을"];
    const merges: boolean[] = [];
    let prev = "";
    let t = 0;
    for (const s of steps) {
      const r = mergeTyping(doc(prev), doc(s), last, (t += 100));
      merges.push(r.merge);
      last = r.state;
      prev = s;
    }
    // '우'(새) '우리'(합침) '우리 '(합침, 어절 끝) '우리 마'(새 어절) '우리 마을'(합침)
    expect(merges).toEqual([false, true, true, false, true]);
  });
  it("글이 아닌 변경, 다른 칸, 2초 넘게 쉬면 새 기록", () => {
    const a = mergeTyping(doc("가"), doc("가나"), null, 0).state;
    expect(mergeTyping(doc("가나"), doc("가나", 4), a, 100).merge).toBe(false);
    expect(mergeTyping(doc("가나"), doc("가나다"), a, 3000).merge).toBe(false);
    expect(mergeTyping({ x: "a", y: "" }, { x: "a", y: "b" }, { path: "/x", wordEnded: false, at: 0 }, 10).merge).toBe(false);
  });
});
