"use client";

import { createContext, useContext, useState } from "react";
import type { Issue } from "@/validation/types";
import { issueKey, withoutDismissed } from "@/validation/design";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl bg-white p-6 shadow-sm ${className}`}>{children}</section>;
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-semibold">{label}</span>
      {children}
      {hint && <span className="block text-xs text-gray-500">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100";

export function NavButtons({
  onBack,
  onNext,
  nextLabel = "다음",
  nextDisabled,
}: {
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
}) {
  return (
    <div className="flex justify-between pt-2">
      {onBack ? (
        <button type="button" onClick={onBack} className="rounded-lg px-4 py-2 text-gray-600 hover:bg-gray-100">
          ← 이전
        </button>
      ) : (
        <span />
      )}
      {onNext && (
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled}
          className="rounded-lg bg-brand-600 px-5 py-2 font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {nextLabel}
        </button>
      )}
    </div>
  );
}

/** 단계 제목과 작성 요령 */
export function StepHeader({ title, tips, children }: { title: string; tips?: string[]; children?: React.ReactNode }) {
  return (
    <Card className="space-y-2">
      <h1 className="text-xl font-bold">{title}</h1>
      {tips && (
        <ul className="list-disc space-y-0.5 pl-5 text-sm text-gray-600">
          {tips.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}
      {children}
    </Card>
  );
}

/** 검증 결과 목록: 어느 항목이 / 왜 / 어떻게 고치는지 */
/** 설계 화면이 내려 주는 '무시하기' (확인 필요 점검만). 없으면 무시하기 버튼을 보이지 않는다 */
export const DismissContext = createContext<{ dismissed: string[]; dismiss: (key: string) => void } | null>(null);

export function IssueList({
  issues: all,
  onGo,
  stepLabel,
}: {
  issues: Issue[];
  onGo?: (i: Issue) => void;
  stepLabel?: (i: Issue) => string;
}) {
  const dm = useContext(DismissContext);
  const issues = withoutDismissed(all, dm?.dismissed);
  if (issues.length === 0) {
    return (
      <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">✓ 지침 위반 사항이 없습니다.</p>
    );
  }
  return (
    <ul className="space-y-2">
      {issues.map((i, k) => (
        <li
          key={k}
          className={`rounded-lg border-l-4 p-3 text-sm ${
            i.level === "error" ? "border-red-500 bg-red-50" : "border-amber-400 bg-amber-50"
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="font-semibold">
              {i.level === "error" ? "오류" : "확인 필요"} · {stepLabel ? `${stepLabel(i)} · ` : ""}
              {i.field}
            </p>
            <span className="flex shrink-0 gap-3">
              {dm && i.level === "warning" && (
                <button
                  type="button"
                  title="권장 사항이라 그대로 두어도 돼요. 이 설계에서는 더 이상 보이지 않아요."
                  onClick={() => dm.dismiss(issueKey(i))}
                  className="text-xs font-semibold text-gray-500 underline hover:text-gray-700"
                >
                  무시하기
                </button>
              )}
              {onGo && i.step && (
                <button type="button" onClick={() => onGo(i)} className="text-xs font-semibold text-brand-700 underline">
                  고치러 가기
                </button>
              )}
            </span>
          </div>
          <p className="text-gray-700">{i.message}</p>
          <p className="text-gray-500">→ {i.fix}</p>
        </li>
      ))}
    </ul>
  );
}

/** 점검 결과 카드 (단계 아래에 붙임) */
export function StepIssues({ issues: all }: { issues: Issue[] }) {
  const dm = useContext(DismissContext);
  const issues = withoutDismissed(all, dm?.dismissed);
  const errors = issues.filter((i) => i.level === "error").length;
  return (
    <Card className="space-y-3">
      <h2 className="font-bold">
        자동 점검 결과{" "}
        {issues.length > 0 && (
          <span className="text-sm font-normal text-gray-500">
            (오류 {errors} · 확인 필요 {issues.length - errors})
          </span>
        )}
      </h2>
      <IssueList issues={issues} />
    </Card>
  );
}

/** 문자열 목록 편집 (한 칸에 한 항목) */
export function ListEditor({
  items,
  onChange,
  placeholder,
  addLabel = "+ 추가",
  multiline = false,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  addLabel?: string;
  multiline?: boolean;
}) {
  return (
    <div className="space-y-2">
      {items.map((v, i) => (
        <div key={i} className="flex gap-2">
          {multiline ? (
            <textarea
              rows={2}
              className={inputClass}
              value={v}
              placeholder={placeholder}
              onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
            />
          ) : (
            <input
              className={inputClass}
              value={v}
              placeholder={placeholder}
              onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
            />
          )}
          <button
            type="button"
            aria-label="삭제"
            className="shrink-0 px-2 text-gray-400 hover:text-red-600"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
          >
            ✕
          </button>
        </div>
      ))}
      <button type="button" className="text-sm font-semibold text-brand-600 hover:underline" onClick={() => onChange([...items, ""])}>
        {addLabel}
      </button>
    </div>
  );
}

/** 복사 상자 */
export function CopyBox({ text, label, rows = 8 }: { text: string; label: string; rows?: number }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert("복사하지 못했습니다. 상자 안을 눌러 전체 선택(Ctrl+A) 후 복사(Ctrl+C)해 주세요.");
    }
  };
  return (
    <div className="space-y-2">
      <textarea
        readOnly
        rows={rows}
        className={`${inputClass} bg-gray-50 font-mono text-xs`}
        value={text}
        onFocus={(e) => e.currentTarget.select()}
      />
      <button type="button" onClick={copy} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
        {copied ? "✓ 복사했어요" : label}
      </button>
    </div>
  );
}

/** 선택 칩 (여러 개 고르기) */
export function Chips({
  options,
  selected,
  onToggle,
  render = (o) => o,
  disabled,
  tone,
}: {
  options: string[];
  selected: string[];
  onToggle: (o: string) => void;
  render?: (o: string) => React.ReactNode;
  /** 고를 수 없는 항목이면 이유 문구, 아니면 false */
  disabled?: (o: string) => string | false;
  /** 항목별 색 (고른 것 / 안 고른 것 클래스). 없으면 기본 색 */
  tone?: (o: string) => { on: string; off: string } | null;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = selected.includes(o);
        const why = !on && disabled ? disabled(o) : false;
        const t = tone?.(o);
        return (
          <button
            key={o}
            type="button"
            disabled={!!why}
            title={why || undefined}
            onClick={() => onToggle(o)}
            className={`rounded-full border px-2.5 py-1 text-xs ${
              on
                ? (t?.on ?? "border-brand-500 bg-brand-50 font-semibold text-brand-700")
                : why
                  ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-300 line-through"
                  : (t?.off ?? "border-gray-300 text-gray-500 hover:border-brand-500")
            }`}
          >
            {on ? "✓ " : ""}
            {render(o)}
          </button>
        );
      })}
    </div>
  );
}

export const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

/** 과목·활동 구분 표시 (연한 배경색: 과목 보라, 활동 하늘) — 설계 현황·설계 화면·관리자 화면에서 같이 쓴다 */
export function TypeTag({ type, className = "" }: { type: "subject" | "activity"; className?: string }) {
  return type === "subject" ? (
    <span className={`rounded bg-violet-100 px-1.5 py-0.5 text-xs font-semibold text-violet-700 ${className}`}>과목</span>
  ) : (
    <span className={`rounded bg-sky-100 px-1.5 py-0.5 text-xs font-semibold text-sky-700 ${className}`}>활동</span>
  );
}
