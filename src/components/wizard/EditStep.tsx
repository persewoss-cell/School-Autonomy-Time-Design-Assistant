"use client";

import type { BasicInfo, Lesson, Plan } from "@/domain/types";
import { checkBasicHours, checkPlanHours, lessonLabels, totalLessonHours } from "@/validation/hours";
import { Card, IssueList, NavButtons, inputClass } from "../ui";

const emptyLesson = (): Lesson => ({ hours: 1, topic: "", goal: "", activities: [""], assessment: "", note: "" });

export function EditStep({
  basic,
  plan,
  onChange,
  onBack,
}: {
  basic: BasicInfo;
  plan: Plan;
  onChange: (p: Plan) => void;
  onBack: () => void;
}) {
  const total = totalLessonHours(plan.units);
  const labels = lessonLabels(plan.units, basic.hours);
  const issues = [...checkBasicHours(basic), ...checkPlanHours(plan, basic)];

  const mutate = (fn: (p: Plan) => void) => {
    const next = structuredClone(plan);
    fn(next);
    onChange(next);
  };
  const setLesson = (ui: number, li: number, patch: Partial<Lesson>) =>
    mutate((p) => Object.assign(p.units[ui].lessons[li], patch));

  return (
    <div className="space-y-4">
      <Card className="space-y-2">
        <h1 className="text-xl font-bold">단원 지도계획 고치기 — {plan.title}</h1>
        <p className="text-sm text-gray-600">
          {basic.name} · {basic.grade}학년 {basic.semester}학기 · {basic.subjectGroup} 편성 · 운영 시수 {basic.hours}시간
        </p>
        <p className={`text-lg font-bold ${total === basic.hours ? "text-green-700" : "text-red-600"}`}>
          차시 합계 {total} / {basic.hours}시간
        </p>
        <p className="text-xs text-gray-500">차시 번호(예: 2~3/29)는 차시 수에 맞춰 자동으로 붙어요.</p>
      </Card>

      {plan.units.map((u, ui) => (
        <Card key={ui} className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-brand-600">{ui + 1}단원</span>
            <input
              className={`${inputClass} font-semibold`}
              value={u.unitName}
              onChange={(e) => mutate((p) => (p.units[ui].unitName = e.target.value))}
            />
            <button
              type="button"
              className="shrink-0 text-sm text-gray-400 hover:text-red-600"
              onClick={() => confirm("이 단원을 삭제할까요?") && mutate((p) => p.units.splice(ui, 1))}
            >
              단원 삭제
            </button>
          </div>

          {u.lessons.map((l, li) => (
            <div key={li} className="grid gap-2 rounded-xl border border-gray-200 p-3 sm:grid-cols-[110px_1fr]">
              <div className="space-y-1">
                <p className="text-sm font-bold">{labels[ui]?.[li]}</p>
                <label className="flex items-center gap-1 text-xs text-gray-500">
                  차시 수
                  <input
                    type="number"
                    min={1}
                    max={10}
                    className="w-14 rounded border border-gray-300 px-1 py-0.5 text-sm"
                    value={l.hours}
                    onChange={(e) => setLesson(ui, li, { hours: Math.max(1, Number(e.target.value) || 1) })}
                  />
                </label>
                <button
                  type="button"
                  className="text-xs text-gray-400 hover:text-red-600"
                  onClick={() => mutate((p) => p.units[ui].lessons.splice(li, 1))}
                >
                  삭제
                </button>
              </div>
              <div className="space-y-2">
                <input className={inputClass} placeholder="학습주제" value={l.topic} onChange={(e) => setLesson(ui, li, { topic: e.target.value })} />
                <input className={inputClass} placeholder="학습 목표 (~해 봅시다.)" value={l.goal} onChange={(e) => setLesson(ui, li, { goal: e.target.value })} />
                <textarea
                  rows={Math.max(2, l.activities.length)}
                  className={inputClass}
                  placeholder="세부 활동 (한 줄에 하나씩, ~하기)"
                  value={l.activities.join("\n")}
                  onChange={(e) => setLesson(ui, li, { activities: e.target.value.split("\n") })}
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <input className={inputClass} placeholder="[과정중심평가] 평가 내용 (없으면 비움)" value={l.assessment} onChange={(e) => setLesson(ui, li, { assessment: e.target.value })} />
                  <input className={inputClass} placeholder="비고 (마을 연계, 코티칭 등)" value={l.note} onChange={(e) => setLesson(ui, li, { note: e.target.value })} />
                </div>
              </div>
            </div>
          ))}
          <button
            type="button"
            className="text-sm font-semibold text-brand-600 hover:underline"
            onClick={() => mutate((p) => p.units[ui].lessons.push(emptyLesson()))}
          >
            + 차시 추가
          </button>
        </Card>
      ))}

      <button
        type="button"
        className="w-full rounded-xl border-2 border-dashed border-gray-300 py-3 text-sm text-gray-500 hover:border-brand-500 hover:text-brand-600"
        onClick={() => mutate((p) => p.units.push({ unitName: "새 단원", standardIds: [], lessons: [emptyLesson()] }))}
      >
        + 단원 추가
      </button>

      <Card className="space-y-3">
        <h2 className="font-bold">자동 점검 결과</h2>
        <IssueList issues={issues} />
        <p className="text-xs text-gray-500">
          다음 단계(내용 체계·성취기준, 평가 계획, 문서 내려받기)는 개발 중입니다.
        </p>
      </Card>
      <NavButtons onBack={onBack} />
    </div>
  );
}
