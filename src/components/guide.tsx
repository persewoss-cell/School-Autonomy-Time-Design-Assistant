"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 화면 안내 도구 모음 (사용자 결정, 2026-11-11)
 * - 파란 알림(토스트): 프롬프트를 복사하면 "AI에 붙여 넣고, 답을 그대로 아래 칸에" 안내. 글 길이에 맞춰 보였다가 사라짐.
 * - 노란 후광: 순서가 있는 화면에서 '다음에 할 칸·버튼'을 천천히 계속 반짝임 (useNextHalo).
 * - 빨간 번쩍임: '고치러 가기'로 간 칸을 두 번 번쩍임 (flashFix).
 */

// ── 파란 알림 ─────────────────────────────────────────────

const TOAST_EVENT = "app-toast";
type ToastMsg = { id: number; title: string; lines: string[] };

export function showToast(title: string, lines: string[]) {
  window.dispatchEvent(new CustomEvent<ToastMsg>(TOAST_EVENT, { detail: { id: Date.now() + Math.random(), title, lines } }));
}

/** 글 길이에 맞춘 표시 시간: 기본 4초 + 글자당 0.07초 (4~20초) */
export const toastDuration = (text: string) => Math.min(20000, Math.max(4000, 4000 + text.length * 70));

/** 프롬프트를 복사했을 때 안내. same: 이미 쓰던 같은 AI 대화창에 보내는 요청(2부·수정·고치기) */
export function promptCopiedToast(same = false) {
  showToast(
    "📋 복사했어요! 이제 AI에 붙여 넣으세요",
    same
      ? [
          "앞에서 쓰던 같은 AI 대화창(ChatGPT, Claude, Gemini 등)의 입력칸에 붙여 넣어(Ctrl+V) 보내세요.",
          "AI의 답이 다 나오면 답 전체를 그대로 복사해, 고치지 말고 아래 칸에 붙여 넣어 주세요.",
          "💡 유료 버전의 가장 높은(최신) 모델로 답을 받을수록 내용이 정확하고 형식도 잘 지켜요.",
        ]
      : [
          "평소 쓰는 생성형 AI 사이트(ChatGPT, Claude, Gemini, 뤼튼 등)를 열고, 입력칸에 붙여 넣어(Ctrl+V) 보내세요.",
          "AI의 답이 다 나오면 답 전체를 그대로 복사해(답 아래 복사 버튼), 고치지 말고 아래 칸에 붙여 넣어 주세요.",
          "💡 유료 버전의 가장 높은(최신) 모델로 답을 받을수록 내용이 정확하고 형식도 잘 지켜요.",
        ],
  );
}

/** 화면 오른쪽 아래 파란 알림 (layout에 하나) */
export function ToastHost() {
  const [list, setList] = useState<ToastMsg[]>([]);
  useEffect(() => {
    const on = (e: Event) => {
      const m = (e as CustomEvent<ToastMsg>).detail;
      // 같은 안내는 하나만 (연달아 눌러도 쌓이지 않게)
      setList((l) => [...l.filter((x) => x.title !== m.title), m]);
      setTimeout(() => setList((l) => l.filter((x) => x.id !== m.id)), toastDuration(m.title + m.lines.join("")));
    };
    window.addEventListener(TOAST_EVENT, on);
    return () => window.removeEventListener(TOAST_EVENT, on);
  }, []);
  if (list.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
      {list.map((m) => (
        <div key={m.id} role="status" className="toast-in pointer-events-auto w-full max-w-lg rounded-xl bg-blue-600 px-4 py-3 text-white shadow-2xl">
          <div className="flex items-start justify-between gap-2">
            <p className="font-bold">{m.title}</p>
            <button type="button" aria-label="알림 닫기" onClick={() => setList((l) => l.filter((x) => x.id !== m.id))} className="-mr-1 rounded px-1.5 text-xl leading-none text-white/80 hover:bg-white/20">
              ×
            </button>
          </div>
          <ul className="mt-1 space-y-0.5 text-sm text-blue-50">
            {m.lines.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// ── 빨간 번쩍임 (고치러 가기) ──────────────────────────────

/** 표시를 찾는다: data-fix="a.b.c"가 없으면 "a.b", "a" 순으로 */
function findFix(target: string): HTMLElement | null {
  const parts = target.split(".");
  for (let n = parts.length; n > 0; n--) {
    const el = document.querySelector<HTMLElement>(`[data-fix="${CSS.escape(parts.slice(0, n).join("."))}"]`);
    if (el && el.offsetParent !== null) return el;
  }
  return null;
}

/**
 * '고치러 가기': 그 칸이 화면에 나타날 때까지(단계 이동·펼치기) 잠깐 기다렸다가
 * 가운데로 스크롤하고 연한 빨간 후광으로 두 번 번쩍인다. 칸이면 커서도 둔다.
 */
export function flashFix(target: string | undefined, fallback?: string) {
  if (!target && !fallback) return;
  const started = Date.now();
  const tryNow = () => {
    // 접힌 곳 안에 있으면 펼쳐 달라고 알림 (data-fix-open 이벤트)
    if (target) window.dispatchEvent(new CustomEvent("fix-open", { detail: target }));
    const exact = target ? findFix(target) : null;
    const el = exact ?? (Date.now() - started > 1200 && fallback ? findFix(fallback) : null);
    if (!el) {
      if (Date.now() - started < 2500) setTimeout(tryNow, 120);
      return;
    }
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.remove("fix-flash");
    void el.offsetWidth; // 애니메이션 다시 시작
    el.classList.add("fix-flash");
    setTimeout(() => el.classList.remove("fix-flash"), 2200);
    const field = el.matches("input,textarea,select") ? el : el.querySelector<HTMLElement>("input:not([type=hidden]),textarea,select");
    if (field && !(field as HTMLInputElement).disabled) setTimeout(() => field.focus({ preventScroll: true }), 400);
  };
  setTimeout(tryNow, 60);
}

// ── 노란 후광 (다음에 할 일) ─────────────────────────────────

/**
 * root 안에서 data-req 표시가 붙은 것 중 화면 순서상 아직 안 한 첫 번째에 노란 후광(halo-next)을 단다.
 * - data-req-done="1"/"0"이 있으면 그 값으로, 없으면 입력칸 값이 비었는지로 판단
 * - 모두 했으면 data-req-final(다음 버튼 등)에 단다
 * - 선택 사항에는 data-req를 붙이지 않는다
 */
export function useNextHalo(enabled = true, /** 바뀌면(단계 이동 등) 다시 붙임 */ resetKey: unknown = 0) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root || !enabled) return;
    let current: HTMLElement | null = null;
    const isDone = (el: HTMLElement) => {
      const d = el.getAttribute("data-req-done");
      if (d !== null) return d === "1";
      if (el.matches("input,textarea,select")) return !!(el as HTMLInputElement).value.trim();
      return false;
    };
    const pick = () => {
      const list = [...root.querySelectorAll<HTMLElement>("[data-req]")].filter((el) => el.offsetParent !== null);
      let next = list.find((el) => !isDone(el)) ?? null;
      if (!next) next = [...root.querySelectorAll<HTMLElement>("[data-req-final]")].find((el) => el.offsetParent !== null && !(el as HTMLButtonElement).disabled) ?? null;
      if (next === current) return;
      current?.classList.remove("halo-next");
      next?.classList.add("halo-next");
      current = next;
    };
    pick();
    let t: ReturnType<typeof setTimeout> | null = null;
    const later = () => {
      if (t) clearTimeout(t);
      t = setTimeout(pick, 80);
    };
    const mo = new MutationObserver(later);
    mo.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-req-done", "disabled", "open", "value"] });
    root.addEventListener("input", later);
    root.addEventListener("change", later);
    root.addEventListener("click", later);
    return () => {
      mo.disconnect();
      root.removeEventListener("input", later);
      root.removeEventListener("change", later);
      root.removeEventListener("click", later);
      if (t) clearTimeout(t);
      current?.classList.remove("halo-next");
    };
  }, [enabled, resetKey]);
  return ref;
}

/** data-req 속성 묶음 (JSX에 펼쳐 넣기) */
export const req = (done?: boolean) => (done === undefined ? { "data-req": "" } : { "data-req": "", "data-req-done": done ? "1" : "0" });
