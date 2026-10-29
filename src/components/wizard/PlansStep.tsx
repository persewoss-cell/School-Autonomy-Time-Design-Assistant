"use client";

import type { BasicInfo, Plan } from "@/domain/types";
import { checkPlanHours, totalLessonHours } from "@/validation/hours";
import { Card, NavButtons } from "../ui";

export function PlansStep({
  basic,
  plans,
  demo,
  onBack,
  onSelect,
}: {
  basic: BasicInfo;
  plans: Plan[];
  demo: boolean;
  onBack: () => void;
  onSelect: (p: Plan) => void;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <h1 className="text-xl font-bold">AI 추천 지도계획 3안</h1>
        <p className="text-sm text-gray-600">마음에 드는 안을 고르세요. 고른 뒤에 차시와 내용을 자유롭게 고칠 수 있어요.</p>
        {demo && (
          <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            지금은 <b>체험 모드</b>입니다. Claude API 키가 설정되지 않아 입력 내용을 끼워 넣은 예시를 보여 줍니다.
            키를 설정하면 실제 AI가 추천합니다.
          </p>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((p, i) => {
          const total = totalLessonHours(p.units);
          const errors = checkPlanHours(p, basic).filter((x) => x.level === "error");
          return (
            <Card key={i} className="flex flex-col gap-3">
              <div>
                <p className="text-xs font-bold text-brand-600">{i + 1}안</p>
                <p className="text-lg font-bold">{p.title}</p>
                <p className="text-sm text-gray-600">{p.concept}</p>
              </div>
              <p className={`text-sm font-semibold ${total === basic.hours ? "text-green-700" : "text-red-600"}`}>
                차시 합계 {total} / {basic.hours}시간 {total === basic.hours ? "✓" : "(맞지 않음)"}
              </p>
              <div className="flex-1 space-y-3 text-sm">
                {p.units.map((u, ui) => (
                  <div key={ui}>
                    <p className="font-semibold">
                      {ui + 1}. {u.unitName}{" "}
                      <span className="font-normal text-gray-400">
                        ({u.lessons.reduce((s, l) => s + l.hours, 0)}차시)
                      </span>
                    </p>
                    <ul className="ml-4 list-disc text-gray-600">
                      {u.lessons.map((l, li) => (
                        <li key={li}>
                          {l.topic} <span className="text-gray-400">({l.hours})</span>
                          {l.assessment && <span className="ml-1 rounded bg-brand-50 px-1 text-xs text-brand-700">평가</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              {errors.length > 0 && <p className="text-xs text-red-600">{errors[0].message}</p>}
              <button
                type="button"
                onClick={() => onSelect(p)}
                className="rounded-lg bg-brand-600 py-2 font-semibold text-white hover:bg-brand-700"
              >
                이 안으로 하기
              </button>
            </Card>
          );
        })}
      </div>
      <NavButtons onBack={onBack} />
    </div>
  );
}
