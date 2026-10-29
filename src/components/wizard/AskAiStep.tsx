"use client";

import { useState } from "react";
import type { BasicInfo, Plan, TopicInput } from "@/domain/types";
import { buildFixPrompt, buildPlanPrompt } from "@/prompts/planPrompt";
import { parsePlans } from "@/prompts/parsePlans";
import { makeDemoPlans } from "@/prompts/demoPlans";
import { Card, NavButtons, inputClass } from "../ui";

function CopyBox({ text, label }: { text: string; label: string }) {
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
        rows={8}
        className={`${inputClass} bg-gray-50 font-mono text-xs`}
        value={text}
        onFocus={(e) => e.currentTarget.select()}
      />
      <button
        type="button"
        onClick={copy}
        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
      >
        {copied ? "✓ 복사했어요" : label}
      </button>
    </div>
  );
}

export function AskAiStep({
  basic,
  input,
  answer,
  onAnswerChange,
  onBack,
  onNext,
}: {
  basic: BasicInfo;
  input: TopicInput;
  answer: string;
  onAnswerChange: (s: string) => void;
  onBack: () => void;
  onNext: (plans: Plan[], demo: boolean, notes: string[]) => void;
}) {
  const [error, setError] = useState("");
  const prompt = buildPlanPrompt(basic, input);

  const read = () => {
    const r = parsePlans(answer);
    if (!r.ok) return setError(r.error);
    setError("");
    onNext(r.plans, false, r.notes);
  };

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <h1 className="text-xl font-bold">AI에게 지도계획 3안 물어보기</h1>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-700">
          <li>아래 <b>프롬프트 복사</b> 버튼을 누릅니다.</li>
          <li>평소 쓰는 AI(ChatGPT, Claude, Gemini, 뤼튼 등)를 새 대화로 열고 붙여 넣어 보냅니다.</li>
          <li>AI의 답을 <b>전부 복사</b>합니다. (답 아래의 복사 버튼을 쓰면 편해요)</li>
          <li>아래 ② 칸에 붙여 넣고 <b>답 읽기</b>를 누릅니다.</li>
        </ol>
        <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
          프롬프트에는 선생님이 입력한 내용만 들어갑니다. AI에게 학생 이름 등 개인정보는 보내지 마세요.
        </p>
      </Card>

      <Card className="space-y-2">
        <h2 className="font-bold">① 프롬프트</h2>
        <CopyBox text={prompt} label="프롬프트 복사" />
      </Card>

      <Card className="space-y-3">
        <h2 className="font-bold">② AI의 답 붙여 넣기</h2>
        <textarea
          rows={10}
          className={`${inputClass} font-mono text-xs`}
          placeholder={'AI의 답을 여기에 그대로 붙여 넣으세요. (```json 으로 시작하는 부분이 들어 있어야 해요)'}
          value={answer}
          onChange={(e) => onAnswerChange(e.target.value)}
        />
        {error && (
          <div className="space-y-2 rounded-lg bg-red-50 p-3 text-sm">
            <p className="font-semibold text-red-700">답을 읽지 못했어요: {error}</p>
            <p className="text-gray-700">
              아래 <b>수정 요청</b>을 복사해서 <b>같은 AI 대화창</b>에 보내고, 새 답을 다시 붙여 넣어 보세요.
            </p>
            <CopyBox text={buildFixPrompt(error, basic.hours)} label="수정 요청 복사" />
          </div>
        )}
        <NavButtons onBack={onBack} onNext={read} nextLabel="답 읽기" nextDisabled={!answer.trim()} />
      </Card>

      <p className="text-center text-sm text-gray-500">
        AI 없이 화면 흐름만 먼저 보고 싶다면{" "}
        <button
          type="button"
          className="font-semibold text-brand-600 underline"
          onClick={() => onNext(makeDemoPlans(basic, input), true, [])}
        >
          예시 3안으로 체험하기
        </button>
      </p>
    </div>
  );
}
