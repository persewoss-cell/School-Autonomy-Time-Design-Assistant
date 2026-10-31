"use client";

import { useEffect, useState } from "react";
import type { Lesson, Plan } from "@/domain/types";
import { areaStandardIds, codeMap } from "@/domain/codes";
import { planPrompt } from "@/prompts/steps";
import { makeDemoPlans } from "@/prompts/demoPlans";
import { checkUnitPlan, planCoverage } from "@/validation/design";
import { checkPlanHours, checkUnitHours, lessonLabels, totalLessonHours } from "@/validation/hours";
import { recommendedUnitHours, unitHoursFor } from "@/domain/unitHours";
import type { PlanRequest } from "@/domain/types";
import { AiAssist } from "./AiAssist";
import { useDesignContext } from "./useSavedDesigns";
import { manualPlan } from "@/domain/manual";
import type { StepProps } from "./DocSteps";
import { Card, Chips, Field, IssueList, NavButtons, StepHeader, StepIssues, inputClass, toggle } from "../ui";

const emptyLesson = (): Lesson => ({ hours: 1, topic: "", goal: "", activities: [""], assessment: "", assessFor: "", inputActivities: [], note: "" });

// ───────────── ⑦ 단원 지도계획 (PPT 51쪽) ─────────────
export function PlanStep(props: StepProps & { designId?: string }) {
  const { doc, setDoc, onBack, onParseFail } = props;
  const tips = [
    "단원명 = 내용 요소의 영역명 또는 재구성",
    "성취기준 = 기술한 성취기준을 영역에 알맞게 배치",
    "학습주제 = 계획한 활동의 주제를 개괄식으로",
    "학습내용 = 학습 순서대로 기술, 다음 단계 평가 계획의 평가 내용을 반드시 포함",
    "전단계에서 적은 '하고 싶은 활동'은 실제 수업이므로 모두 넣어요",
    "과정중심평가는 성취기준마다 1개씩, 그 성취기준의 내용을 배우는 차시에 둬요 (성취기준 2개면 2개, 3개면 3개)",
  ];

  const blockers = checkUnitHours(
    doc.basic.hours,
    unitHoursFor(doc).map((h, i) => ({ name: doc.areas[i].name, hours: h })),
  );

  if (!doc.plan.selected) {
    return (
      <div className="space-y-4">
        <StepHeader title="단원 지도계획 — 3안 받기" tips={tips} />
        <PlanRequestCard doc={doc} setDoc={setDoc} />
        {blockers.length > 0 ? (
          <Card className="space-y-2 border-2 border-red-200">
            <p className="font-bold text-red-700">단원별 차시를 먼저 맞춰야 AI에게 물을 수 있어요.</p>
            <IssueList issues={blockers} />
          </Card>
        ) : (
          <AiAssist
            doc={doc}
            step={planPrompt}
            hasContent={doc.plan.candidates.length > 0}
            title="AI에게 단원 지도계획 3안 받기"
            defaultOpen
            onParseFail={(e) => onParseFail?.("plan", e)}
            onApply={(plans, notes) =>
              setDoc((d) => {
                d.plan = { candidates: plans, demo: false, notes, selected: null };
              })
            }
            onManual={() => setDoc((d) => void (d.plan = { candidates: [], demo: false, notes: [], selected: manualPlan(d) }))}
            onReset={() => setDoc((d) => void (d.plan = { candidates: [], demo: false, notes: [], selected: null }))}
          />
        )}
        {doc.plan.candidates.length > 0 && <Candidates {...props} />}
        {blockers.length === 0 && <p className="text-center text-sm text-gray-500">
          AI 없이 화면 흐름만 먼저 보고 싶다면{" "}
          <button
            type="button"
            className="font-semibold text-brand-600 underline"
            onClick={() => {
              if (doc.plan.candidates.length > 0 && !confirm("이미 받은 단원 지도계획 안이 있어요. 예시 3안으로 바꾸면 기존 내용이 지워져요. 계속할까요?")) return;
              setDoc((d) => void (d.plan = { candidates: makeDemoPlans(d), demo: true, notes: [], selected: null }));
            }}
          >
            예시 3안으로 체험하기
          </button>
        </p>}
        <NavButtons onBack={onBack} />
      </div>
    );
  }
  return <EditPlan {...props} tips={tips} />;
}

const emptyRequest = (): PlanRequest => ({ unitHours: [], mustInclude: [], notes: "" });

/** AI에게 묻기 전에: 단원별 차시, 꼭 넣을 내용, 기타 참고사항 (모두 프롬프트에 들어감) */
function PlanRequestCard({ doc, setDoc }: Pick<StepProps, "doc" | "setDoc">) {
  const req = doc.planRequest ?? emptyRequest();
  const rec = recommendedUnitHours(doc);
  const hours = unitHoursFor(doc);
  const sum = hours.reduce((a, b) => a + b, 0);
  const update = (fn: (r: PlanRequest) => void) =>
    setDoc((d) => {
      d.planRequest = d.planRequest ?? emptyRequest();
      fn(d.planRequest);
    });
  // 줄바꿈을 그대로 두려고 입력 중인 글은 따로 들고 있다
  const [must, setMust] = useState(req.mustInclude.join("\n"));
  return (
    <Card className="space-y-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">단원별 차시 정하기</h2>
          {req.unitHours.some((v) => typeof v === "number") && (
            <button type="button" className="text-sm text-gray-500 underline" onClick={() => update((r) => void (r.unitHours = []))}>
              모두 추천대로
            </button>
          )}
        </div>
        <p className="text-sm text-gray-600">
          단원(= 내용 체계의 영역)마다 몇 차시로 할지 적어요. 빈칸은 추천(내용 요소 수 비율)대로 채워져요. 합계는 운영 시수 {doc.basic.hours}차시와 같아야 해요.
        </p>
        <div className="divide-y divide-gray-100">
          {doc.areas.map((a, i) => {
            const v = req.unitHours[i];
            const typed = typeof v === "number";
            return (
              <div key={i} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="text-sm">
                  <b>{i + 1}단원</b> ({a.name}) <span className="text-gray-500">추천 {rec[i]}차시</span>
                </span>
                <label className="flex items-center gap-1 text-sm">
                  <input
                    type="number"
                    min={1}
                    max={doc.basic.hours}
                    className={`w-20 rounded border px-2 py-1 text-right ${hours[i] < 1 ? "border-red-400 bg-red-50" : "border-gray-300"}`}
                    placeholder={String(hours[i])}
                    value={typed ? v : ""}
                    onChange={(e) =>
                      update((r) => {
                        const n = parseInt(e.target.value, 10);
                        const list = doc.areas.map((_, k) => r.unitHours[k] ?? null);
                        list[i] = Number.isFinite(n) && n > 0 ? n : null;
                        r.unitHours = list;
                      })
                    }
                  />
                  차시{!typed && <span className="text-xs text-gray-400">(추천 적용: {hours[i]})</span>}
                </label>
              </div>
            );
          })}
        </div>
        <p className={`text-sm font-semibold ${sum === doc.basic.hours ? "text-green-700" : "text-red-600"}`}>
          합계 {sum} / {doc.basic.hours}차시 {sum === doc.basic.hours ? "✓" : ""}
        </p>
      </div>
      <Field label="단원 지도계획에 반드시 넣을 내용 (선택, 한 줄에 하나씩)" hint="전단계에서 적지 않았지만 꼭 들어가야 할 수업 내용이나 행사. 예: 학교 축제 연계 발표 / 현장체험학습(○○ 박물관) 2차시">
        <textarea
          rows={3}
          className={inputClass}
          value={must}
          onChange={(e) => {
            setMust(e.target.value);
            const lines = e.target.value.split("\n").map((t) => t.trim()).filter(Boolean);
            update((r) => void (r.mustInclude = lines));
          }}
        />
      </Field>
      <Field label="기타 참고사항 (선택)" hint="예: 10월 둘째 주는 행사로 수업이 어려움 / 모둠 활동 위주로 / 원어민 강사는 2단원에만 참여">
        <textarea rows={3} className={inputClass} value={req.notes} onChange={(e) => update((r) => void (r.notes = e.target.value))} />
      </Field>
      <p className="text-xs text-gray-500">여기 적은 내용은 아래 AI 프롬프트에 그대로 들어가요. 학생 이름 등 개인정보는 적지 마세요.</p>
    </Card>
  );
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

function EditPlan({ doc, setDoc, onBack, onNext, tips, designId }: StepProps & { tips: string[]; designId?: string }) {
  const ctx = useDesignContext(doc, designId);
  const plan = doc.plan.selected!;
  const codes = codeMap(doc);
  const total = totalLessonHours(plan.units);
  const labels = lessonLabels(plan.units, doc.basic.hours);
  const mutate = (fn: (p: Plan) => void) => setDoc((d) => fn(d.plan.selected!));
  // n번째 단원 = n번째 영역의 성취기준: 성취기준을 고치거나 단원이 바뀌면 맞춰 둔다 (되돌리기 기록에는 넣지 않음)
  const synced = plan.units.every((u, ui) => u.standardIds.join() === areaStandardIds(doc, ui).join());
  useEffect(() => {
    if (!synced) setDoc((d) => d.plan.selected!.units.forEach((u, ui) => (u.standardIds = areaStandardIds(d, ui))), false);
  }, [synced, setDoc]);
  const setLesson = (ui: number, li: number, patch: Partial<Lesson>) => mutate((p) => Object.assign(p.units[ui].lessons[li], patch));

  return (
    <div className="space-y-4">
      <StepHeader title={`단원 지도계획 고치기 — ${plan.title}`} tips={tips}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={`text-lg font-bold ${total === doc.basic.hours ? "text-green-700" : "text-red-600"}`}>
            차시 합계 {total} / {doc.basic.hours}시간
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="text-sm text-gray-500 underline"
              onClick={() => confirm("고친 내용을 버리고 3안 고르기로 돌아갈까요?") && setDoc((d) => void (d.plan.selected = null))}
            >
              다른 안 고르기 / AI에게 다시 받기
            </button>
            <button
              type="button"
              className="rounded-lg border border-red-100 bg-red-50 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-100"
              onClick={() =>
                confirm("이 단계에서 AI 답으로 만든 내용(3안과 고른 안)을 모두 지울까요?\n지운 내용은 되돌릴 수 없어요.") &&
                setDoc((d) => void (d.plan = { candidates: [], demo: false, notes: [], selected: null }))
              }
            >
              AI 답변 초기화
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-500">차시 번호(예: 2~3/{doc.basic.hours})는 차시 수에 맞춰 자동으로 붙어요.</p>
      </StepHeader>
      <CoverageCard doc={doc} plan={plan} labels={labels} />

      {plan.units.map((u, ui) => (
        <Card key={ui} className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-sm font-bold text-brand-600">{ui + 1}단원</span>
            <input className={`${inputClass} font-semibold`} value={u.unitName} onChange={(e) => mutate((p) => void (p.units[ui].unitName = e.target.value))} />
            <span className="shrink-0 text-sm font-semibold text-gray-500">
              {u.lessons.reduce((sum, l) => sum + l.hours, 0)}차시
            </span>
            <button
              type="button"
              className="shrink-0 text-sm text-gray-400 hover:text-red-600"
              onClick={() => confirm("이 단원을 삭제할까요?") && mutate((p) => void p.units.splice(ui, 1))}
            >
              단원 삭제
            </button>
          </div>
          <div className="rounded-lg bg-gray-50 p-2 text-sm">
            <p className="mb-1 text-xs text-gray-500">이 단원의 성취기준 ({ui + 1}번째 영역)</p>
            {u.standardIds.filter((id) => codes.has(id)).length === 0 ? (
              <p className="text-xs text-red-600">{ui + 1}번째 영역에 성취기준이 없어요. 영역 수와 단원 수가 같은지 확인해 주세요.</p>
            ) : (
              u.standardIds
                .filter((id) => codes.has(id))
                .map((id) => (
                  <p key={id}>
                    <span className="font-mono text-xs font-bold text-brand-700">{codes.get(id)}</span> {doc.standards.find((x) => x.id === id)?.text}
                  </p>
                ))
            )}
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
      <StepIssues issues={checkUnitPlan(doc, ctx)} />
      <NavButtons onBack={onBack} onNext={onNext} />
    </div>
  );
}
