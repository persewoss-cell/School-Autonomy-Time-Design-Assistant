"use client";

import { useEffect, useRef, useState } from "react";
import { emptyDesign, type DesignDoc } from "@/domain/types";
import { sampleSubject } from "@/domain/sample";
import type { StepKey } from "@/validation/types";
import { TypeStep } from "./TypeStep";
import { BasicStep } from "./BasicStep";
import { TopicStep } from "./TopicStep";
import { ContentStep, CoreIdeasStep, IntroStep, StandardsStep, TeachingStep, type StepProps } from "./DocSteps";
import { PlanStep } from "./PlanStep";
import { AssessmentStep } from "./AssessmentStep";
import { ApplicationStep, FinalStep } from "./FinalSteps";

/**
 * 설계 단계. 문서 작성 부분은 2027 연수 PPT의 순서를 따른다:
 * [전단계] 활동 내용 선정 → 내용 체계 → 핵심아이디어 → 성취기준 → 필요성(성격) 및 목표 → 단원 지도계획 → 평가 계획
 */
function stepsFor(doc: DesignDoc): { key: StepKey; label: string }[] {
  const subject = doc.basic.type === "subject";
  return [
    { key: "type", label: "유형" },
    { key: "basic", label: "기본 정보" },
    { key: "topic", label: "전단계" },
    { key: "content", label: "내용 체계" },
    { key: "coreIdeas", label: "핵심아이디어" },
    { key: "standards", label: "성취기준" },
    { key: "intro", label: subject ? "성격·목표" : "필요성·목표" },
    { key: "plan", label: "단원 지도계획" },
    { key: "assessment", label: "평가 계획" },
    ...(subject ? [{ key: "teaching" as StepKey, label: "교수·학습" }] : []),
    { key: "application", label: subject ? "신청서" : "계획서" },
    { key: "final", label: "점검·내려받기" },
  ];
}

const DRAFT_KEY = "sat-design-v3";

export interface WizardProps {
  /** 저장된 설계를 열 때 */
  initial?: DesignDoc;
  /** 저장 기능 (로그인 + DB 설정 시) */
  onSave?: (doc: DesignDoc) => Promise<void>;
  onParseFail?: (step: string, error: string) => void;
  onDownloaded?: (doc: DesignDoc) => void;
  /** 브라우저 임시 보관 사용 여부 (새 설계일 때만) */
  useDraft?: boolean;
}

export function Wizard({ initial, onSave, onParseFail, onDownloaded, useDraft = !initial }: WizardProps) {
  const [doc, setDocState] = useState<DesignDoc>(() => initial ?? emptyDesign());
  const [stepKey, setStepKey] = useState<StepKey>(initial ? "final" : "type");
  const [maxIndex, setMaxIndex] = useState(initial ? 99 : 0);
  const [saved, setSaved] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const loaded = useRef(false);

  // 작성 중인 새 설계를 이 브라우저에 임시 보관
  useEffect(() => {
    if (useDraft) {
      try {
        const raw = localStorage.getItem(DRAFT_KEY);
        if (raw) {
          const s = JSON.parse(raw);
          setDocState({ ...emptyDesign(), ...s.doc });
          setStepKey(s.stepKey ?? "type");
          setMaxIndex(s.maxIndex ?? 0);
        }
      } catch {
        /* 임시 보관을 못 읽어도 새로 시작하면 됨 */
      }
    }
    loaded.current = true;
  }, [useDraft]);
  useEffect(() => {
    if (!loaded.current || !useDraft) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ doc, stepKey, maxIndex }));
    } catch {
      /* 저장 공간을 못 쓰는 환경이면 무시 */
    }
  }, [doc, stepKey, maxIndex, useDraft]);

  const steps = stepsFor(doc);
  const index = Math.max(0, steps.findIndex((s) => s.key === stepKey));
  const goIndex = (i: number) => {
    const next = steps[Math.min(Math.max(i, 0), steps.length - 1)];
    setStepKey(next.key);
    setMaxIndex((m) => Math.max(m, i));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const goTo = (key: StepKey) => goIndex(steps.findIndex((s) => s.key === key));
  const setDoc = (fn: (d: DesignDoc) => void) =>
    setDocState((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
  const reset = () => {
    if (!confirm("작성 중인 내용을 모두 지우고 처음부터 시작할까요?")) return;
    setDocState(emptyDesign());
    setStepKey("type");
    setMaxIndex(0);
  };
  const save = onSave
    ? async () => {
        setSaved("saving");
        try {
          await onSave(doc);
          setSaved("saved");
        } catch (e) {
          setSaved("error");
          alert(e instanceof Error ? e.message : "저장하지 못했습니다.");
        }
      }
    : undefined;

  const props: StepProps = {
    doc,
    setDoc,
    onBack: () => goIndex(index - 1),
    onNext: () => goIndex(index + 1),
    onParseFail,
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-gray-500">
            {doc.basic.name ? <b className="text-gray-800">{doc.basic.name}</b> : "새 설계"} · {doc.basic.type === "subject" ? "과목" : "활동"} · {doc.basic.grade}학년 {doc.basic.semester}학기
          </p>
          <div className="flex items-center gap-3 text-sm">
            {save && (
              <button type="button" onClick={save} className="rounded-lg border border-brand-500 px-3 py-1 font-semibold text-brand-700 hover:bg-brand-50">
                {saved === "saving" ? "저장 중…" : saved === "saved" ? "✓ 저장됨" : "💾 저장"}
              </button>
            )}
            {useDraft && (
              <button type="button" onClick={reset} className="text-gray-400 hover:text-red-600">
                처음부터 다시
              </button>
            )}
          </div>
        </div>
        <ol className="flex flex-wrap gap-1.5 text-xs">
          {steps.map((s, i) => (
            <li key={s.key}>
              <button
                type="button"
                disabled={i > maxIndex}
                onClick={() => goIndex(i)}
                className={`rounded-full px-2.5 py-1 ${
                  i === index
                    ? "bg-brand-600 font-semibold text-white"
                    : i <= maxIndex
                      ? "bg-brand-100 text-brand-700 hover:bg-brand-50"
                      : "bg-gray-100 text-gray-400"
                }`}
              >
                {i + 1}. {s.label}
              </button>
            </li>
          ))}
        </ol>
      </div>

      {stepKey === "type" && (
        <TypeStep
          value={doc.basic.type}
          onNext={(type) => {
            setDoc((d) => void (d.basic.type = type));
            goIndex(1);
          }}
          onLoadSample={
            useDraft
              ? () => {
                  if (doc.basic.name && !confirm("작성 중인 내용 대신 예시를 불러올까요?")) return;
                  setDocState(sampleSubject());
                  setStepKey("final");
                  setMaxIndex(99);
                }
              : undefined
          }
        />
      )}
      {stepKey === "basic" && (
        <BasicStep
          value={doc.basic}
          onBack={props.onBack}
          onNext={(basic) => {
            setDoc((d) => void (d.basic = basic));
            goIndex(index + 1);
          }}
        />
      )}
      {stepKey === "topic" && (
        <TopicStep
          value={doc.input}
          onBack={props.onBack}
          onNext={(input) => {
            setDoc((d) => void (d.input = input));
            goIndex(index + 1);
          }}
        />
      )}
      {stepKey === "content" && <ContentStep {...props} />}
      {stepKey === "coreIdeas" && <CoreIdeasStep {...props} />}
      {stepKey === "standards" && <StandardsStep {...props} />}
      {stepKey === "intro" && <IntroStep {...props} />}
      {stepKey === "plan" && <PlanStep {...props} />}
      {stepKey === "assessment" && <AssessmentStep {...props} />}
      {stepKey === "teaching" && <TeachingStep {...props} />}
      {stepKey === "application" && <ApplicationStep {...props} />}
      {stepKey === "final" && (
        <FinalStep
          {...props}
          goTo={goTo}
          stepLabel={(k) => steps.find((s) => s.key === k)?.label ?? ""}
          onSave={save}
          onDownloaded={() => onDownloaded?.(doc)}
        />
      )}
    </div>
  );
}
