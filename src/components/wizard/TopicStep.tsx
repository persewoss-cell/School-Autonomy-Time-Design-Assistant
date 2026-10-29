"use client";

import { useState } from "react";
import { topicInputSchema, type BasicInfo, type Plan, type TopicInput } from "@/domain/types";
import { Card, Field, NavButtons, inputClass } from "../ui";

const toLines = (s: string) =>
  s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

export function TopicStep({
  basic,
  value,
  onBack,
  onNext,
}: {
  basic: BasicInfo;
  value: TopicInput;
  onBack: () => void;
  onNext: (input: TopicInput, plans: Plan[], demo: boolean) => void;
}) {
  const [topic, setTopic] = useState(value.topic);
  const [required, setRequired] = useState(value.requiredContents.join("\n"));
  const [desired, setDesired] = useState(value.desiredActivities.join("\n"));
  const [context, setContext] = useState(value.schoolContext);
  const [resources, setResources] = useState(value.resources);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    const parsed = topicInputSchema.safeParse({
      topic,
      requiredContents: toLines(required),
      desiredActivities: toLines(desired),
      schoolContext: context,
      resources,
    });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요.");
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ basic, input: parsed.data }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "추천을 받지 못했습니다.");
      onNext(parsed.data, data.plans, data.demo);
    } catch (e) {
      setError(e instanceof Error ? e.message : "추천을 받지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="space-y-5">
      <h1 className="text-xl font-bold">주제와 내용</h1>
      <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
        학생 이름 등 개인정보는 적지 마세요.
      </p>

      <Field label="주제" hint="예: 세계시민으로 함께 살아가기, 우리 마을 생태 지킴이">
        <input className={inputClass} value={topic} onChange={(e) => setTopic(e.target.value)} />
      </Field>
      <Field label="꼭 들어가야 할 내용 (한 줄에 하나씩)" hint="예: 세계와 연결된 나의 삶 / 문화 다양성 존중">
        <textarea rows={4} className={inputClass} value={required} onChange={(e) => setRequired(e.target.value)} />
      </Field>
      <Field label="하고 싶은 활동 (한 줄에 하나씩)" hint="예: 역할극 발표 / 마을학교 체험 / UCC 제작">
        <textarea rows={4} className={inputClass} value={desired} onChange={(e) => setDesired(e.target.value)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="학교·지역 여건 (선택)" hint="학교 특색교육, 학생 특성, 교육공동체 요구 등">
          <textarea rows={3} className={inputClass} value={context} onChange={(e) => setContext(e.target.value)} />
        </Field>
        <Field label="연계 가능한 자원 (선택)" hint="마을학교, 체험처, 원어민·강사 등 인적 자원">
          <textarea rows={3} className={inputClass} value={resources} onChange={(e) => setResources(e.target.value)} />
        </Field>
      </div>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {loading && (
        <p className="rounded-lg bg-brand-50 p-3 text-sm text-brand-700">
          AI가 지도계획 3안을 만들고 있어요. 1~2분 정도 걸릴 수 있어요…
        </p>
      )}
      <NavButtons onBack={onBack} onNext={submit} nextLabel={loading ? "추천 받는 중…" : "AI 추천 받기"} nextDisabled={loading} />
    </Card>
  );
}
