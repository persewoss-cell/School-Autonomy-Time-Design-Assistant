"use client";

import { useState } from "react";
import type { DesignDoc } from "@/domain/types";
import type { StepPrompt } from "@/prompts/steps";
import { buildFixPrompt } from "@/prompts/common";
import { Card, CopyBox, inputClass } from "../ui";

/**
 * "AI에게 초안 받기" 패널.
 * 프롬프트 복사 → 교사가 각자 쓰는 AI에 붙여 넣기 → 답 붙여 넣기 → 코드가 읽고 걸러서 적용.
 */
export function AiAssist<T>({
  doc,
  step,
  onApply,
  hasContent,
  title = "AI에게 초안 받기",
  defaultOpen,
  onParseFail,
}: {
  doc: DesignDoc;
  step: StepPrompt<T>;
  onApply: (data: T, notes: string[]) => void;
  /** 이미 내용이 있으면 덮어쓰기 전에 묻는다 */
  hasContent: boolean;
  title?: string;
  defaultOpen?: boolean;
  onParseFail?: (error: string) => void;
}) {
  const [open, setOpen] = useState(defaultOpen ?? !hasContent);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [notes, setNotes] = useState<string[]>([]);

  const read = () => {
    const r = step.parse(answer, doc);
    if (!r.ok) {
      setError(r.error);
      onParseFail?.(r.error);
      return;
    }
    if (hasContent && !confirm("지금 작성된 내용을 AI의 답으로 바꿀까요?")) return;
    setError("");
    setNotes(r.notes);
    setAnswer("");
    onApply(r.data, r.notes);
  };

  return (
    <Card className="space-y-3 border-2 border-dashed border-brand-100">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between text-left">
        <span className="font-bold text-brand-700">🤖 {title}</span>
        <span className="text-sm text-gray-400">{open ? "접기 ▲" : "펼치기 ▼"}</span>
      </button>
      {notes.length > 0 && (
        <ul className="space-y-1">
          {notes.map((n) => (
            <li key={n} className="rounded-lg bg-blue-50 p-2 text-sm text-blue-800">
              ℹ️ {n}
            </li>
          ))}
        </ul>
      )}
      {open && (
        <div className="space-y-4">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-700">
            <li>
              <b>프롬프트 복사</b>를 누르고, 평소 쓰는 AI(ChatGPT, Claude, Gemini, 뤼튼 등)에 붙여 넣어 보냅니다.
            </li>
            <li>AI의 답을 전부 복사해 아래 칸에 붙여 넣고 <b>답 읽기</b>를 누릅니다.</li>
            <li>읽어 온 내용은 아래에서 자유롭게 고칠 수 있어요. AI 없이 직접 써도 됩니다.</li>
          </ol>
          <p className="text-xs text-amber-700">AI에게 학생 이름 등 개인정보는 보내지 마세요.</p>
          <CopyBox text={step.build(doc)} label="프롬프트 복사" rows={6} />
          <textarea
            rows={6}
            className={`${inputClass} font-mono text-xs`}
            placeholder={"AI의 답을 여기에 그대로 붙여 넣으세요. (```json 으로 시작하는 부분이 들어 있어야 해요)"}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
          />
          {error && (
            <div className="space-y-2 rounded-lg bg-red-50 p-3 text-sm">
              <p className="font-semibold text-red-700">답을 읽지 못했어요: {error}</p>
              <p className="text-gray-700">
                아래 <b>수정 요청</b>을 복사해 <b>같은 AI 대화창</b>에 보내고, 새 답을 다시 붙여 넣어 보세요.
              </p>
              <CopyBox text={buildFixPrompt(error, step.reminder(doc))} label="수정 요청 복사" rows={5} />
            </div>
          )}
          <button
            type="button"
            onClick={read}
            disabled={!answer.trim()}
            className="rounded-lg border-2 border-brand-600 px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50 disabled:border-gray-300 disabled:text-gray-300"
          >
            답 읽기
          </button>
        </div>
      )}
    </Card>
  );
}
