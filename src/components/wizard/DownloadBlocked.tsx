"use client";

import type { DesignDoc } from "@/domain/types";
import { checklistResults } from "@/validation/design";
import type { Issue, StepKey } from "@/validation/types";
import { Modal } from "../Modal";

/** 문서를 내려받지 못하는 이유 한 가지 */
export interface BlockReason {
  kind: "error" | "check";
  title: string;
  detail: string;
  step: StepKey;
  /** 고칠 칸 (data-fix) */
  target?: string;
}

/**
 * 내려받기 전에 꼭 마쳐야 하는 것 (사용자 결정, 2026-11-11): 오류 + 직접 확인할 체크리스트.
 * 확인 필요(노랑)·시수 점검은 막지 않는다. 자동 체크리스트(○/X)는 오류를 고치면 저절로 ○가 되므로 따로 넣지 않는다.
 */
export function blockReasons(doc: DesignDoc, issues: Issue[]): BlockReason[] {
  const errors: BlockReason[] = issues
    .filter((i) => i.level === "error")
    .map((i) => ({ kind: "error", title: i.field, detail: `${i.message} → ${i.fix}`, step: i.step ?? "final", target: i.target }));
  // 체크리스트는 하나로 묶어서 (고치러 가기 → 체크 안 한 칸이 모두 번쩍, 사용자 결정 2026-11-11)
  const left = checklistResults(doc, {}, issues).filter((c) => !c.auto && !c.ok).length;
  const checks: BlockReason[] = left
    ? [{ kind: "check", title: "체크리스트", detail: `확인하지 않은 체크리스트가 ${left}개 있어요. 내용을 직접 점검하고 체크해 주세요.`, step: "final", target: "check.left" }]
    : [];
  return [...errors, ...checks];
}

export function DownloadBlockedModal({
  reasons,
  stepLabel,
  onGo,
  onClose,
}: {
  reasons: BlockReason[];
  stepLabel: (s: StepKey) => string;
  onGo: (r: BlockReason) => void;
  onClose: () => void;
}) {
  const errors = reasons.filter((r) => r.kind === "error").length;
  const checks = reasons.length - errors;
  return (
    <Modal
      title="아직 문서를 내려받을 수 없어요"
      wide
      onClose={onClose}
      actions={
        <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-5 py-2 font-semibold text-gray-700 hover:bg-gray-50">
          닫기
        </button>
      }
    >
      <p className="font-semibold">
        아래 {reasons.length}가지를 마쳐야 문서가 만들어져요.
        <span className="ml-1 text-sm font-normal text-gray-600">
          ({[errors ? `오류 ${errors}개` : "", checks ? "확인하지 않은 체크리스트" : ""].filter(Boolean).join(", ")})
        </span>
      </p>
      <p className="text-sm text-gray-600">
        <b>고치러 가기</b>를 누르면 그 단계의 그 칸으로 가서 빨갛게 번쩍여 알려 줘요.
      </p>
      <ul className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
        {reasons.map((r, k) => (
          <li key={k} className={`flex items-start justify-between gap-3 rounded-lg border-l-4 p-3 text-sm ${r.kind === "error" ? "border-red-500 bg-red-50" : "border-amber-400 bg-amber-50"}`}>
            <div className="min-w-0">
              <p className="font-semibold">
                {r.kind === "error" ? "오류" : "체크 안 함"} · {stepLabel(r.step)} · {r.title}
              </p>
              <p className="text-gray-700">{r.detail}</p>
            </div>
            <button
              type="button"
              onClick={() => onGo(r)}
              className="shrink-0 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold whitespace-nowrap text-white hover:bg-red-700"
            >
              고치러 가기
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
