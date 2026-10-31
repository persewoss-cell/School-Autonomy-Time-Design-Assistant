/**
 * 되돌리기 기록을 어디서 끊을지 정한다.
 * - 같은 글 칸에 이어서 치는 것은 한 어절(띄어쓰기까지)씩 한 번으로 묶는다.
 * - 고르기·추가·삭제처럼 글이 아닌 변경은 한 번에 한 기록.
 * - 2초 넘게 쉬었다가 다시 치면 새 기록.
 */

/** 두 값에서 달라진 곳 (최대 2곳까지만 찾음). 글이 아닌 변경이면 kind가 'other' */
export function diffPaths(a: unknown, b: unknown, path = "", out: { path: string; kind: "text" | "other"; before?: string; after?: string }[] = []) {
  if (out.length >= 2 || a === b) return out;
  if (typeof a === "string" && typeof b === "string") {
    out.push({ path, kind: "text", before: a, after: b });
    return out;
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    if (Array.isArray(a) !== Array.isArray(b) || (Array.isArray(a) && a.length !== (b as unknown[]).length)) {
      out.push({ path, kind: "other" });
      return out;
    }
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) diffPaths((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}/${k}`, out);
    return out;
  }
  out.push({ path, kind: "other" });
  return out;
}

export interface TypingState {
  path: string;
  /** 직전 입력이 띄어쓰기로 끝나 다음 입력은 새 어절 */
  wordEnded: boolean;
  at: number;
}

/** 이번 변경을 직전 기록에 합칠지(merge), 그리고 다음 판단에 쓸 상태 */
export function mergeTyping(prev: unknown, next: unknown, last: TypingState | null, now: number): { merge: boolean; state: TypingState | null } {
  const d = diffPaths(prev, next);
  if (d.length !== 1 || d[0].kind !== "text") return { merge: false, state: null };
  const { path, before = "", after = "" } = d[0];
  const added = after.startsWith(before) ? after.slice(before.length) : "";
  const wordEnded = /\s$/.test(after) || /\s/.test(added);
  const merge = !!last && last.path === path && !last.wordEnded && now - last.at <= 2000;
  return { merge, state: { path, wordEnded, at: now } };
}
