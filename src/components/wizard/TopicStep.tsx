"use client";

import { useState } from "react";
import { topicInputSchema, type TopicInput } from "@/domain/types";
import { Card, Field, NavButtons, inputClass } from "../ui";

const toLines = (s: string) =>
  s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

export function TopicStep({
  value,
  onBack,
  onNext,
}: {
  value: TopicInput;
  onBack: () => void;
  onNext: (input: TopicInput) => void;
}) {
  const [topic, setTopic] = useState(value.topic);
  const [required, setRequired] = useState(value.requiredContents.join("\n"));
  const [desired, setDesired] = useState(value.desiredActivities.join("\n"));
  const [context, setContext] = useState(value.schoolContext);
  const [resources, setResources] = useState(value.resources);
  const [areaCount, setAreaCount] = useState(value.areaCount ? String(value.areaCount) : "");
  const [areaNames, setAreaNames] = useState((value.areaNames ?? []).join("\n"));
  const [error, setError] = useState("");

  const submit = () => {
    const parsed = topicInputSchema.safeParse({
      topic,
      requiredContents: toLines(required),
      desiredActivities: toLines(desired),
      schoolContext: context,
      resources,
      areaCount: areaCount ? Number(areaCount) : null,
      areaNames: toLines(areaNames),
    });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요.");
    if (parsed.data.areaCount && parsed.data.areaNames.length > parsed.data.areaCount) {
      return setError(`정해 둔 영역명이 ${parsed.data.areaNames.length}개인데 영역 수는 ${parsed.data.areaCount}개입니다. 영역 수를 늘리거나 영역명을 줄여 주세요.`);
    }
    setError("");
    onNext(parsed.data);
  };

  return (
    <Card className="space-y-5">
      <h1 className="text-xl font-bold">[전단계] 주제 관련 활동 내용 선정</h1>
      <p className="text-sm text-gray-600">주제와 꼭 다룰 내용, 하고 싶은 활동을 정리해요. 여기 적은 내용이 이후 모든 단계의 AI 프롬프트에 들어가요.</p>
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
      <div className="space-y-3 rounded-xl border border-gray-200 p-4">
        <p className="text-sm font-semibold">내용 체계 영역 (선택 — 비워 두면 AI가 주제와 학년에 맞게 정해요)</p>
        <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
          <Field label="영역 수" hint="2~3개 권장">
            <select className={inputClass} value={areaCount} onChange={(e) => setAreaCount(e.target.value)}>
              <option value="">알아서 (2~3개)</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}개
                </option>
              ))}
            </select>
          </Field>
          <Field label="정해 둔 영역명 (한 줄에 하나씩, 순서대로)" hint="일부만 적어도 돼요. 나머지는 AI가 정해요. 예: 세계시민의 이해 / 문화 다양성과 존중">
            <textarea rows={3} className={inputClass} value={areaNames} onChange={(e) => setAreaNames(e.target.value)} />
          </Field>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="학교·지역 여건 (선택)" hint="학교 특색교육, 학생 특성, 교육공동체 요구 등">
          <textarea rows={3} className={inputClass} value={context} onChange={(e) => setContext(e.target.value)} />
        </Field>
        <Field label="연계 가능한 자원 (선택)" hint="마을학교, 체험처, 원어민·강사 등 인적 자원">
          <textarea rows={3} className={inputClass} value={resources} onChange={(e) => setResources(e.target.value)} />
        </Field>
      </div>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <NavButtons onBack={onBack} onNext={submit} nextLabel="다음: 내용 체계" />
    </Card>
  );
}
