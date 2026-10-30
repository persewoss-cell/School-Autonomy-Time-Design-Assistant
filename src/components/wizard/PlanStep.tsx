"use client";

import type { Lesson, Plan } from "@/domain/types";
import { codeMap } from "@/domain/codes";
import { planPrompt } from "@/prompts/steps";
import { makeDemoPlans } from "@/prompts/demoPlans";
import { checkUnitPlan, planCoverage } from "@/validation/design";
import { checkPlanHours, lessonLabels, totalLessonHours } from "@/validation/hours";
import { AiAssist } from "./AiAssist";
import type { StepProps } from "./DocSteps";
import { Card, Chips, NavButtons, StepHeader, StepIssues, inputClass, toggle } from "../ui";

const emptyLesson = (): Lesson => ({ hours: 1, topic: "", goal: "", activities: [""], assessment: "", assessFor: "", inputActivities: [], note: "" });

// ───────────── ⑦ 단원 지도계획 (PPT 51쪽) ─────────────
export function PlanStep(props: StepProps) {
  const { doc, setDoc, onBack, onParseFail } = props;
  const tips = [
    "단원명 = 내용 요소의 영역명 또는 재구성",
    "성취기준 = 기술한 성취기준을 영역에 알맞게 배치",
    "학습주제 = 계획한 활동의 주제를 개괄식으로",
    "학습내용 = 학습 순서대로 기술, 다음 단계 평가 계획의 평가 내용을 반드시 포함",
    "전단계에서 적은 '하고 싶은 활동'은 실제 수업이므로 모두 넣어요",
    "과정중심평가는 성취기준마다 1개씩, 그 성취기준의 내용을 배우는 차시에 둬요 (성취기준 2개면 2개, 3개면 3개)",
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
          const cov = planCoverage(doc, p);
          const actDone = cov.activities.filter((a) => a.done).length;
          const assessOk = doc.standards.filter((s) => cov.assessed.get(s.id) === 1).length;
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
              {cov.activities.length > 0 && (
                <p className={`-mt-2 text-sm font-semibold ${actDone === cov.activities.length ? "text-green-700" : "text-red-600"}`}>
                  전단계 활동 {actDone} / {cov.activities.length} {actDone === cov.activities.length ? "✓" : `(빠짐: ${cov.activities.filter((a) => !a.done).map((a) => a.text).join(", ")})`}
                </p>
              )}
              <p className={`-mt-2 text-sm font-semibold ${assessOk === doc.standards.length ? "text-green-700" : "text-red-600"}`}>
                과정중심평가 성취기준별 1개 {assessOk} / {doc.standards.length} {assessOk === doc.standards.length ? "✓" : ""}
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
                          {l.assessment && (
                            <span className="ml-1 rounded bg-brand-50 px-1 text-xs text-brand-700">평가 {codes.get(l.assessFor) ?? ""}</span>
                          )}
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

/** 전단계 활동과 과정중심평가가 어느 차시에 들어갔는지 한눈에 */
function CoverageCard({ doc, plan, labels }: { doc: StepProps["doc"]; plan: Plan; labels: string[][] }) {
  const codes = codeMap(doc);
  const where = (match: (l: Lesson) => boolean) =>
    plan.units.flatMap((u, ui) => u.lessons.flatMap((l, li) => (match(l) ? [`${labels[ui]?.[li]} ${l.topic}`] : [])));
  return (
    <Card className="grid gap-4 md:grid-cols-2">
      <div className="space-y-1">
        <h2 className="font-bold">전단계 활동 반영</h2>
        {doc.input.desiredActivities.length === 0 && <p className="text-sm text-gray-500">전단계에서 적은 활동이 없어요.</p>}
        {doc.input.desiredActivities.map((a) => {
          const at = where((l) => (l.inputActivities ?? []).includes(a));
          return (
            <p key={a} className={`text-sm ${at.length ? "text-gray-700" : "font-semibold text-red-600"}`}>
              {at.length ? "✓" : "✕"} {a} <span className="text-xs font-normal text-gray-500">{at.length ? `— ${at.join(", ")}` : "— 아직 어느 차시에도 없어요"}</span>
            </p>
          );
        })}
      </div>
      <div className="space-y-1">
        <h2 className="font-bold">과정중심평가 (성취기준마다 1개)</h2>
        {doc.standards.map((s) => {
          const at = where((l) => l.assessFor === s.id);
          return (
            <p key={s.id} className={`text-sm ${at.length === 1 ? "text-gray-700" : "font-semibold text-red-600"}`}>
              {at.length === 1 ? "✓" : "✕"} <span className="font-mono">{codes.get(s.id)}</span>{" "}
              <span className="text-xs font-normal text-gray-500">
                {at.length === 0 ? "— 아직 배정 안 됨" : at.length === 1 ? `— ${at[0]}` : `— ${at.length}개 배정됨 (1개만): ${at.join(", ")}`}
              </span>
            </p>
          );
        })}
      </div>
    </Card>
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
      <CoverageCard doc={doc} plan={plan} labels={labels} />

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
                {doc.input.desiredActivities.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-gray-500">전단계 활동</span>
                    <Chips
                      options={doc.input.desiredActivities}
                      selected={l.inputActivities ?? []}
                      onToggle={(a) => setLesson(ui, li, { inputActivities: toggle(l.inputActivities ?? [], a) })}
                    />
                  </div>
                )}
                <div className={`space-y-2 rounded-lg p-2 ${l.assessFor ? "bg-brand-50" : "bg-gray-50"}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-gray-600">[과정중심평가]</span>
                    <select
                      className="rounded border border-gray-300 bg-white px-2 py-1 text-sm"
                      value={l.assessFor && codes.has(l.assessFor) ? l.assessFor : ""}
                      onChange={(e) => setLesson(ui, li, { assessFor: e.target.value })}
                    >
                      <option value="">평가 안 함</option>
                      {u.standardIds
                        .filter((id) => codes.has(id))
                        .map((id) => {
                          const elsewhere = plan.units.some((uu, uj) => uu.lessons.some((ll, lj) => (uj !== ui || lj !== li) && ll.assessFor === id));
                          return (
                            <option key={id} value={id} disabled={elsewhere && l.assessFor !== id}>
                              {codes.get(id)} 평가{elsewhere && l.assessFor !== id ? " (다른 차시에 배정됨)" : ""}
                            </option>
                          );
                        })}
                    </select>
                    {l.assessFor && <span className="text-xs text-gray-500">{doc.standards.find((s) => s.id === l.assessFor)?.text}</span>}
                  </div>
                  {(l.assessFor || l.assessment) && (
                    <input className={inputClass} placeholder="평가 내용 (예: ~을 조사하여 발표하기)" value={l.assessment} onChange={(e) => setLesson(ui, li, { assessment: e.target.value })} />
                  )}
                </div>
                <input className={inputClass} placeholder="비고 (마을 연계, 코티칭 등)" value={l.note} onChange={(e) => setLesson(ui, li, { note: e.target.value })} />
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
