"use client";

import { useState } from "react";
import type { DesignType } from "@/domain/types";
import { Card, NavButtons } from "../ui";

const OPTIONS: { type: DesignType; title: string; points: string[] }[] = [
  {
    type: "activity",
    title: "활동",
    points: [
      "학교장 승인 (학교교육과정위원회 자문 → 학교운영위원회 심의)",
      "문서: 필요성 및 목표, 내용 체계, 성취기준, 지도의 실제",
      "기존 교과 성취기준을 재구조화해 쓸 수 있어요",
      "같은 학교·같은 해에 같은 활동명은 안 돼요",
    ],
  },
  {
    type: "subject",
    title: "과목",
    points: [
      "교육감 승인",
      "문서: 성격, 목표, 내용 체계, 성취기준, 교수·학습 방법 및 평가, 지도의 실제",
      "성취기준을 새로 개발해야 해요",
      "전국 과목명과 겹치면 안 돼요",
    ],
  },
];

export function TypeStep({ value, onNext }: { value: DesignType; onNext: (t: DesignType) => void }) {
  const [type, setType] = useState<DesignType>(value);
  return (
    <Card className="space-y-4">
      <h1 className="text-xl font-bold">무엇을 설계할까요?</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {OPTIONS.map((o) => (
          <button
            key={o.type}
            type="button"
            onClick={() => setType(o.type)}
            className={`rounded-xl border-2 p-5 text-left transition ${
              type === o.type ? "border-brand-500 bg-brand-50" : "border-gray-200 hover:border-brand-100"
            }`}
          >
            <p className="text-lg font-bold">학교자율시간 {o.title}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-600">
              {o.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </button>
        ))}
      </div>
      <NavButtons onNext={() => onNext(type)} />
    </Card>
  );
}
