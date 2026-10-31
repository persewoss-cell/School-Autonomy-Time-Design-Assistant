"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 여러 개 고르는 드롭다운. 아무것도 안 고르면 '전체'.
 * 체크 상자는 여러 개 고르기, 이름을 누르면 그것 하나만 고르기.
 */
export function MultiSelect({
  allLabel,
  options,
  selected,
  onChange,
}: {
  allLabel: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const label =
    selected.length === 0 ? allLabel : selected.length === 1 ? (options.find((o) => o.value === selected[0])?.label ?? selected[0]) : `${selected.length}개 선택`;
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex min-w-32 items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm ${selected.length ? "border-brand-500 bg-brand-50 font-semibold text-brand-700" : "border-gray-300 bg-white text-gray-700"}`}
      >
        <span className="max-w-44 truncate">{label}</span>
        <span className="text-xs text-gray-400">▾</span>
      </button>
      {open && (
        <div className="absolute z-30 mt-1 max-h-72 min-w-52 overflow-auto rounded-lg border border-gray-200 bg-white p-1 shadow-lg">
          <button type="button" onClick={() => onChange([])} className={`block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-gray-50 ${selected.length === 0 ? "font-semibold text-brand-700" : ""}`}>
            {allLabel}
          </button>
          {options.map((o) => (
            <div key={o.value} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-gray-50">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={selected.includes(o.value)}
                onChange={() => onChange(selected.includes(o.value) ? selected.filter((v) => v !== o.value) : [...selected, o.value])}
              />
              <button
                type="button"
                className="flex-1 text-left text-sm"
                onClick={() => {
                  onChange([o.value]);
                  setOpen(false);
                }}
              >
                {o.label}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
