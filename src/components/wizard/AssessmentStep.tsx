"use client";

import type { AssessmentRow } from "@/domain/types";
import { codeMap } from "@/domain/codes";
import { ASSESS_METHODS, assessmentPrompt } from "@/prompts/steps";
import { checkAssessments } from "@/validation/design";
import { manualAssessments } from "@/domain/manual";
import { AiAssist } from "./AiAssist";
import type { StepProps } from "./DocSteps";
import { Card, Chips, Field, NavButtons, StepHeader, StepIssues, inputClass, toggle } from "../ui";

const emptyRow = (): AssessmentRow => ({ month: "", standardIds: [], focus: "", levels: { A: "", B: "", C: "" }, methods: [] });

// ───────────── ⑧ 평가 계획 (PPT 52쪽) ─────────────
export function AssessmentStep({ doc, setDoc, onBack, onNext, onParseFail }: StepProps) {
  const codes = codeMap(doc);
  const set = (i: number, fn: (r: AssessmentRow) => void) => setDoc((d) => fn(d.assessments[i]));

  return (
    <div className="space-y-4">
      <StepHeader
        title="평가 계획 작성"
        tips={[
          "시기 = 평가 내용별 적당한 시기의 월",
          "성취기준 = 기술한 성취기준을 영역에 알맞게 배치 (두 개의 성취기준을 합하여 평가 가능)",
          "수업·평가 방법, 연계의 주안점 = 학습 내용에 따른 평가 내용을 양식에 맞춰 기술",
          "성취수준 = A·B·C 단계에 맞춰 기술 (배움이 느린 학습자도 참여할 수 있게)",
          "방법 = 관찰평가, 자기평가, 동료평가, 산출물평가 등 다양한 방법 활용",
          doc.basic.type === "subject" ? "과목은 모든 성취기준에 대한 성취수준을 작성해야 해요" : "단원 지도계획의 [과정중심평가]와 내용이 맞아야 해요",
        ]}
      />
      <AiAssist
        doc={doc}
        step={assessmentPrompt}
        hasContent={doc.assessments.length > 0}
        onParseFail={(e) => onParseFail?.("assessment", e)}
        onApply={(rows) => setDoc((d) => void (d.assessments = rows))}
        onManual={() => setDoc((d) => void (d.assessments = manualAssessments(d)))}
        onReset={() => setDoc((d) => void (d.assessments = []))}
      />
      {doc.assessments.map((r, i) => (
        <Card key={i} className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">평가 {i + 1}</h2>
            <button type="button" className="text-sm text-gray-400 hover:text-red-600" onClick={() => setDoc((d) => void d.assessments.splice(i, 1))}>
              삭제
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
            <Field label="시기">
              <input className={inputClass} value={r.month} placeholder="예: 9월" onChange={(e) => set(i, (x) => void (x.month = e.target.value))} />
            </Field>
            <div className="space-y-1">
              <p className="text-sm font-semibold">성취기준</p>
              <Chips
                options={doc.standards.map((s) => s.id)}
                selected={r.standardIds}
                onToggle={(id) => set(i, (x) => void (x.standardIds = toggle(x.standardIds, id)))}
                render={(id) => codes.get(id)}
              />
            </div>
          </div>
          <Field label="수업·평가 방법, 연계의 주안점" hint="예: [협력중심 학습] ▪ 평가 내용 ⇒ (관찰평가, 동료평가) 확인 방법">
            <textarea rows={3} className={inputClass} value={r.focus} onChange={(e) => set(i, (x) => void (x.focus = e.target.value))} />
          </Field>
          {(["A", "B", "C"] as const).map((lv) => (
            <Field key={lv} label={`성취수준 ${lv}`}>
              <input className={inputClass} value={r.levels[lv]} placeholder="~할 수 있다." onChange={(e) => set(i, (x) => void (x.levels[lv] = e.target.value))} />
            </Field>
          ))}
          <div className="space-y-1">
            <p className="text-sm font-semibold">방법</p>
            <Chips options={[...new Set([...ASSESS_METHODS, ...r.methods])]} selected={r.methods} onToggle={(m) => set(i, (x) => void (x.methods = toggle(x.methods, m)))} />
          </div>
        </Card>
      ))}
      <button
        type="button"
        className="w-full rounded-xl border-2 border-dashed border-gray-300 py-3 text-sm text-gray-500 hover:border-brand-500 hover:text-brand-600"
        onClick={() => setDoc((d) => void d.assessments.push(emptyRow()))}
      >
        + 평가 추가
      </button>
      <StepIssues issues={checkAssessments(doc)} />
      <NavButtons onBack={onBack} onNext={onNext} />
    </div>
  );
}
