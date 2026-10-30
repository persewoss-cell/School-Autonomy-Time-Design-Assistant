"use client";

import { useEffect } from "react";

/** 화면 가운데 뜨는 알림 창. 오른쪽 위 ✕ 또는 Esc로 닫는다. */
export function Modal({
  title,
  tone = "red",
  onClose,
  children,
  actions,
}: {
  title: string;
  tone?: "red" | "amber";
  onClose: () => void;
  children: React.ReactNode;
  actions: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const head = tone === "red" ? "bg-red-600" : "bg-amber-500";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div role="alertdialog" aria-modal="true" aria-label={title} className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className={`flex items-center justify-between gap-2 px-5 py-3 text-white ${head}`}>
          <p className="text-lg font-bold">⚠ {title}</p>
          <button type="button" aria-label="닫기" onClick={onClose} className="rounded-md px-2 text-2xl leading-none text-white/90 hover:bg-white/20">
            ×
          </button>
        </div>
        <div className="space-y-2 px-5 py-4 text-[15px] text-gray-800">{children}</div>
        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-3">{actions}</div>
      </div>
    </div>
  );
}
