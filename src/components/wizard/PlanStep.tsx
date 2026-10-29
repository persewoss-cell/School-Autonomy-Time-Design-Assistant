"use client";

import type { Lesson, Plan } from "@/domain/types";
import { codeMap } from "@/domain/codes";
import { planPrompt } from "@/prompts/steps";
import { makeDemoPlans } from "@/prompts/demoPlans";
import { checkUnitPlan } from "@/validation/design";
import { checkPlanHours, lessonLabels, totalLessonHours } from "@/validation/hours";
import { AiAssist } from "./AiAssist";
import type { StepProps } from "./DocSteps";
import { Card, Chips, NavButtons, StepHeader, StepIssues, inputClass, toggle } from "../ui";

const emptyLesson = (): Lesson => ({ hours: 1, topic: "", goal: "", activities: [""], assessment: "", note: "" });

// ───────────── ⑦ 단원 지도계획 (PPT 51쪽) ─────────────
export function PlanStep(props: StepProps) {
  const { doc, setDoc, onBack, onParseFail } = props;
  const tips = [
    "단원명 = 내용 요소의 영역명 또는 재구성",
    "성취기준 = 기술한 성취기준을 영역에 알맞게 배치",
    "학습주제 = 계획한 활동의 주제를 개괄식으로",
    "학습내용 = 학습 순서대로 기술, 다음 단계 평가 계획의 평가 내용을 반드시 포함",
  ];

  if (!doc.plan.selected) {
    return (
      <div className="space-y-4">
        <StepHeader title="단원 지도계획 — 3안 받기" tips={tips} />
        <AiAssist
          doc={doc}
          step={planPrompt}
          hasContent={false}
          title="AI에게 단원 지도계획 3안 받기"
          defaultOpen
          onParseFail={(e) => onParseFail?.("plan", e)}
          onApply={(plans, notes) =>
            setDoc((d) => {
              d.plan = { candidates: plans, demo: false, notes, selected: null };
            })
          }
        />
        {doc.plan.candidates.length > 0 && <Candidates {...props} />}
        <p className="text-center text-sm text-gray-500">
          AI 없이 화면 흐름만 먼저 보고 싶다면{" "}
          <button
            type="button"
            className="font-semibold text-brand-600 underline"
            onClick={() => setDoc((d) => void (d.plan = { candidates: makeDemoPlans(d), demo: true, notes: [], selected: null }))}
          >
            예시 3안으로 체험하기
          </button>
        </p>
        <NavButtons onBack={onBack} />
      </div>
    );
  }
  return <EditPlan {...props} tips={tips} />;
}

function Candidates({ doc, setDoc }: StepProps) {
  const codes = codeMap(doc);
  return (
    <div className="space-y-3">
      {doc.plan.demo && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          지금은 <b>예시 3안</b>입니다. 연습용이므로 실제 설계는 AI에게 받은 답을 붙여 넣으세요.
        </p>
      )}
      {doc.plan.notes.map((n) => (
        <p key={n} className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">ℹ️ {n}</p>
      ))}
      <div className="grid gap-4 lg:grid-cols-3">
        {doc.plan.candidates.map((p, i) => {
          const total = totalLessonHours(p.units);
          const err = checkPlanHours(p, doc.basic).find((x) => x.level === "error");
          return (
            <Card key={i} className="flex flex-col gap-3">
              <div>
                <p className="text-xs font-bold text-brand-600">{i + 1}안</p>
                <p className="text-lg font-bold">{p.title}</p>
                <p className="text-sm text-gray-600">{p.concept}</p>
              </div>
              <p className={`text-sm font-semibold ${total === doc.basic.hours ? "text-green-700" : "text-red-600"}`}>
                차시 합계 {total} / {doc.basic.hours}시간 {total === doc.basic.hours ? "✓" : "(맞지 않음)"}
              </p>
              <div className="flex-1 space-y-3 text-sm">
                {p.units.map((u, ui) => (
                  <div key={ui}>
                    <p className="font-semibold">
                      {ui + 1}. {u.unitName} <span className="font-normal text-gray-400">({u.lessons.reduce((s, l) => s + l.hours, 0)}차시)</span>
                    </p>
                    <p className="font-mono text-xs text-brand-700">{u.standardIds.map((id) => codes.get(id)).join(" ")}</p>
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
              {err && <p className="text-xs text-red-600">{err.message} 고른 뒤에 고칠 수 있어요.</p>}
              <button
                type="button"
                onClick={() => setDoc((d) => void (d.plan.selected = structuredClone(p)))}
                className="rounded-lg bg-brand-600 py-2 font-semibold text-white hover:bg-brand-700"
              >
                이 안으로 하기
              </button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function EditPlan({ doc, setDoc, onBack, onNext, tips }: StepProps & { tips: string[] }) {
  const plan = doc.plan.selected!;
  const codes = codeMap(doc);
  const total = totalLessonHours(plan.units);
  const labels = lessonLabels(plan.units, doc.basic.hours);
  const mutate = (fn: (p: Plan) => void) => setDoc((d) => fn(d.plan.selected!));
  const setLesson = (ui: number, li: number, patch: Partial<Lesson>) => mutate((p) => Object.assign(p.units[ui].lessons[li], patch));

  return (
    <div className="space-y-4">
      <StepHeader title={`단원 지도계획 고치기 — ${plan.title}`} tips={tips}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={`text-lg font-bold ${total === doc.basic.hours ? "text-green-700" : "text-red-600"}`}>
            차시 합계 {total} / {doc.basic.hours}시간
          </p>
          <button
            type="button"
            className="text-sm text-gray-500 underline"
            onClick={() => confirm("고친 내용을 버리고 3안 고르기로 돌아갈까요?") && setDoc((d) => void (d.plan.selected = null))}
          >
            다른 안 고르기 / AI에게 다시 받기
          </button>
        </div>
        <p className="text-xs text-gray-500">차시 번호(예: 2~3/{doc.basic.hours})는 차시 수에 맞춰 자동으로 붙어요.</p>
      </StepHeader>

      {plan.units.map((u, ui) => (
        <Card key={ui} className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-sm font-bold text-brand-600">{ui + 1}단원</span>
            <input className={`${inputClass} font-semibold`} value={u.unitName} onChange={(e) => mutate((p) => void (p.units[ui].unitName = e.target.value))} />
            <button
              type="button"
              className="shrink-0 text-sm text-gray-400 hover:text-red-600"
              onClick={() => confirm("이 단원을 삭제할까요?") && mutate((p) => void p.units.splice(ui, 1))}
            >
              단원 삭제
            </button>
          </div>
          <div>
            <p className="mb-1 text-xs text-gray-500">이 단원의 성취기준 (눌러서 고르기)</p>
            <Chips
              options={doc.standards.map((s) => s.id)}
              selected={u.standardIds}
              onToggle={(id) => mutate((p) => void (p.units[ui].standardIds = toggle(p.units[ui].standardIds, id)))}
              render={(id) => {
                const s = doc.standards.find((x) => x.id === id);
                return `${codes.get(id)} ${s ? s.text.slice(0, 18) + (s.text.length > 18 ? "…" : "") : ""}`;
              }}
            />
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
                    max={32}
                    className="w-14 rounded border border-gray-300 px-1 py-0.5 text-sm"
                    value={l.hours}
                    onChange={(e) => setLesson(ui, li, { hours: Math.max(1, Number(e.target.value) || 1) })}
                  />
                </label>
                <div className="flex gap-2 text-xs text-gray-400">
                  <button type="button" disabled={li === 0} className="hover:text-brand-600 disabled:opacity-30" onClick={() => mutate((p) => { const ls = p.units[ui].lessons; [ls[li - 1], ls[li]] = [ls[li], ls[li - 1]]; })}>▲</button>
                  <button type="button" disabled={li === u.lessons.length - 1} className="hover:text-brand-600 disabled:opacity-30" onClick={() => mutate((p) => { const ls = p.units[ui].lessons; [ls[li + 1], ls[li]] = [ls[li], ls[li + 1]]; })}>▼</button>
                  <button type="button" className="hover:text-red-600" onClick={() => mutate((p) => void p.units[ui].lessons.splice(li, 1))}>삭제</button>
                </div>
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
          <button type="button" className="text-sm font-semibold text-brand-600 hover:underline" onClick={() => mutate((p) => void p.units[ui].lessons.push(emptyLesson()))}>
            + 차시 추가
          </button>
        </Card>
      ))}
      <button
        type="button"
        className="w-full rounded-xl border-2 border-dashed border-gray-300 py-3 text-sm text-gray-500 hover:border-brand-500 hover:text-brand-600"
        onClick={() => mutate((p) => void p.units.push({ unitName: "새 단원", standardIds: [], lessons: [emptyLesson()] }))}
      >
        + 단원 추가
      </button>
      <StepIssues issues={checkUnitPlan(doc)} />
      <NavButtons onBack={onBack} onNext={onNext} />
    </div>
  );
}
