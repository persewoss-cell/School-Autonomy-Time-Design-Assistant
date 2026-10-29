import type { Issue } from "@/validation/types";

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

/** 검증 결과 목록: 어느 항목이 / 왜 / 어떻게 고치는지 */
export function IssueList({ issues }: { issues: Issue[] }) {
  if (issues.length === 0) {
    return (
      <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
        ✓ 지금까지 입력한 내용에서 지침 위반 사항이 없습니다.
      </p>
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
          <p className="font-semibold">
            {i.level === "error" ? "오류" : "확인 필요"} · {i.field}
          </p>
          <p className="text-gray-700">{i.message}</p>
          <p className="text-gray-500">→ {i.fix}</p>
        </li>
      ))}
    </ul>
  );
}
