"use client";

import { useEffect, useRef, useState } from "react";
import { emptyDesign, type DesignDoc } from "@/domain/types";
import { sampleSubject } from "@/domain/sample";
import type { StepKey } from "@/validation/types";
import { validateDesign } from "@/validation/design";
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
export function stepsFor(doc: { basic: Pick<DesignDoc["basic"], "type"> }): { key: StepKey; label: string }[] {
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

export const DRAFT_KEY = "sat-design-v3";
const draftKeyFor = (designId?: string) => (designId ? `${DRAFT_KEY}:${designId}` : DRAFT_KEY);

interface Draft {
  doc: DesignDoc;
  stepKey: StepKey;
  maxIndex: number;
  savedAt: number;
  /** 서버에 아직 저장되지 않은 고침이 있는지 */
  dirty: boolean;
}

function readDraft(key: string): Draft | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

/** 단계에 작성한 내용이 있는지 (없으면 단계 버튼을 회색으로) */
function stepStarted(doc: DesignDoc, key: StepKey): boolean {
  switch (key) {
    case "type":
      return true;
    case "basic":
      return !!doc.basic.name.trim();
    case "topic":
      return !!doc.input.topic.trim();
    case "content":
      return doc.areas.some((a) => a.name.trim() || a.knowledge.length || a.process.length || a.values.length);
    case "coreIdeas":
      return doc.coreIdeas.some((s) => s.trim());
    case "standards":
      return doc.standards.length > 0;
    case "intro":
      return !!(doc.intro.rationale.trim() || doc.intro.overallGoal.trim());
    case "plan":
      return !!doc.plan.selected || doc.plan.candidates.length > 0;
    case "assessment":
      return doc.assessments.length > 0;
    case "teaching":
      return Object.values(doc.teaching).some((l) => l.length > 0);
    default:
      // 계획서·신청서, 점검·내려받기: 들어가 본 적이 있으면 진행한 것으로
      return true;
  }
}

/** 저장된 진행 위치가 없을 때: 아직 오류가 남은 첫 단계부터 */
function resumeStep(doc: DesignDoc): StepKey {
  if (doc.progress?.stepKey) return doc.progress.stepKey as StepKey;
  const errorSteps = new Set(validateDesign(doc).filter((i) => i.level === "error").map((i) => i.step));
  return stepsFor(doc).find((s) => errorSteps.has(s.key))?.key ?? "final";
}

export interface WizardProps {
  /** 저장된 설계를 열 때 */
  initial?: DesignDoc;
  /** 저장된 설계의 id (브라우저 임시 보관을 설계마다 따로 함) */
  designId?: string;
  /** 서버 저장 (로그인 + DB 설정 시). auto: 단계 이동 때 자동 저장 */
  onSave?: (doc: DesignDoc, opts: { auto: boolean }) => Promise<void>;
  onParseFail?: (step: string, error: string) => void;
  onDownloaded?: (doc: DesignDoc) => void;
  /** 로그인한 학교명: 계획서·신청서의 학교명이 비어 있으면 채움 */
  defaultSchoolName?: string;
}

export function Wizard({ initial, designId, onSave, onParseFail, onDownloaded, defaultSchoolName }: WizardProps) {
  const isNew = !initial;
  const [doc, setDocState] = useState<DesignDoc>(() => initial ?? emptyDesign());
  const [stepKey, setStepKey] = useState<StepKey>(() => (initial ? resumeStep(initial) : "type"));
  const [maxIndex, setMaxIndex] = useState(() => initial?.progress?.maxIndex ?? (initial ? 99 : 0));
  const [saved, setSaved] = useState<{ state: "idle" | "saving" | "saved" | "error"; at?: Date; auto?: boolean }>({ state: "idle" });
  const [restoredNote, setRestoredNote] = useState("");
  const docRef = useRef(doc);
  const dirtyRef = useRef(false);
  const loaded = useRef(false);
  const draftKey = draftKeyFor(designId);

  // 브라우저 임시 보관 불러오기: 새 설계는 항상, 저장된 설계는 서버에 아직 안 올라간 고침이 있을 때만
  useEffect(() => {
    const d = readDraft(draftKey);
    if (d && (isNew || d.dirty) && !loaded.current) {
      dirtyRef.current = !!d.dirty;
      const restored = { ...emptyDesign(), ...d.doc };
      docRef.current = restored;
      setDocState(restored);
      setStepKey(d.stepKey ?? "type");
      setMaxIndex(d.maxIndex ?? 0);
      if (!isNew) setRestoredNote("이 브라우저에 임시 저장된 최근 내용을 불러왔어요. (서버에는 다음 단계로 넘어가거나 저장하면 반영돼요)");
    }
    loaded.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 쓰는 내용은 바로바로 이 브라우저에 임시 저장
  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify({ doc, stepKey, maxIndex, savedAt: Date.now(), dirty: dirtyRef.current } satisfies Draft));
    } catch {
      /* 저장 공간을 못 쓰는 환경이면 무시 */
    }
  }, [doc, stepKey, maxIndex, draftKey]);

  // 새 설계가 처음 서버에 저장되어 id가 생기면, 임시 보관도 그 설계 것으로 옮김
  const prevKey = useRef(draftKey);
  useEffect(() => {
    if (prevKey.current !== draftKey) {
      try {
        localStorage.removeItem(prevKey.current);
      } catch {
        /* 무시 */
      }
      prevKey.current = draftKey;
    }
  }, [draftKey]);

  const commit = (next: DesignDoc) => {
    docRef.current = next;
    dirtyRef.current = true;
    setDocState(next);
  };
  /** 서버 저장이 끝났고 그 사이 고친 게 없으면 '저장됨'으로 표시 */
  const markClean = (target: DesignDoc) => {
    if (docRef.current !== target) return;
    dirtyRef.current = false;
    try {
      const d = readDraft(draftKey);
      if (d) localStorage.setItem(draftKey, JSON.stringify({ ...d, dirty: false }));
    } catch {
      /* 무시 */
    }
  };
  const setDoc = (fn: (d: DesignDoc) => void) => {
    const next = structuredClone(docRef.current);
    fn(next);
    commit(next);
  };

  useEffect(() => {
    if (defaultSchoolName && !doc.application.schoolName.trim()) {
      setDoc((d) => void (d.application.schoolName = defaultSchoolName));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultSchoolName, doc.application.schoolName]);

  const runSave = async (target: DesignDoc, auto: boolean) => {
    if (!onSave) return;
    setSaved({ state: "saving", auto });
    try {
      await onSave(target, { auto });
      markClean(target);
      setSaved({ state: "saved", at: new Date(), auto });
    } catch (e) {
      setSaved({ state: "error", auto });
      if (!auto) alert(e instanceof Error ? e.message : "저장하지 못했습니다.");
    }
  };

  const steps = stepsFor(doc);
  const index = Math.max(0, steps.findIndex((s) => s.key === stepKey));
  const errorSteps = new Set(validateDesign(doc).filter((i) => i.level === "error").map((i) => i.step));
  /** 단계 이동: 진행 위치를 문서에 적고, 로그인했으면 서버에 자동 저장 */
  const goIndex = (i: number) => {
    const list = stepsFor(docRef.current);
    const to = Math.min(Math.max(i, 0), list.length - 1);
    const nextMax = Math.max(maxIndex, to);
    setStepKey(list[to].key);
    setMaxIndex(nextMax);
    setRestoredNote("");
    const next = { ...docRef.current, progress: { stepKey: list[to].key, maxIndex: nextMax } };
    commit(next);
    void runSave(next, true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const goTo = (key: StepKey) => goIndex(stepsFor(docRef.current).findIndex((s) => s.key === key));
  const reset = () => {
    if (!confirm("작성 중인 내용을 모두 지우고 처음부터 시작할까요?")) return;
    commit(emptyDesign());
    setStepKey("type");
    setMaxIndex(0);
  };
  const save = onSave
    ? () => {
        const target = { ...docRef.current, progress: { stepKey, maxIndex } };
        commit(target);
        return runSave(target, false);
      }
    : undefined;
  const savedLabel =
    saved.state === "saving"
      ? "저장 중…"
      : saved.state === "error"
        ? "⚠ 자동 저장 실패 — 💾 저장을 눌러 주세요"
        : saved.state === "saved" && saved.at
          ? `✓ ${saved.auto ? "자동 " : ""}저장됨 ${saved.at.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}`
          : onSave
            ? "단계를 넘기면 자동 저장돼요"
            : "이 브라우저에 임시 저장 중";

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
            <span className={`text-xs ${saved.state === "error" ? "text-red-600" : "text-gray-400"}`}>{savedLabel}</span>
            {save && (
              <button type="button" onClick={save} className="rounded-lg border border-brand-500 px-3 py-1 font-semibold text-brand-700 hover:bg-brand-50">
                💾 저장
              </button>
            )}
            {isNew && !designId && (
              <button type="button" onClick={reset} className="text-gray-400 hover:text-red-600">
                처음부터 다시
              </button>
            )}
          </div>
        </div>
        <ol
          className="grid grid-cols-4 gap-1 sm:grid-cols-6 md:[grid-template-columns:repeat(var(--steps),minmax(0,1fr))]"
          style={{ "--steps": steps.length } as React.CSSProperties}
        >
          {steps.map((s, i) => {
            const state = i > maxIndex || !stepStarted(doc, s.key) ? "todo" : errorSteps.has(s.key) ? "error" : "done";
            const current = i === index;
            const color = current
              ? state === "error"
                ? "bg-red-600 text-white"
                : "bg-brand-600 text-white"
              : state === "error"
                ? "bg-red-50 text-red-700 ring-1 ring-red-300 hover:bg-red-100"
                : state === "done"
                  ? "bg-brand-100 text-brand-700 hover:bg-brand-50"
                  : "bg-gray-100 text-gray-400 hover:bg-gray-200";
            return (
              <li key={s.key} className="min-w-0">
                <button
                  type="button"
                  disabled={i > maxIndex}
                  onClick={() => goIndex(i)}
                  title={state === "error" ? `${s.label}: 고칠 오류가 있어요` : state === "todo" ? `${s.label}: 아직 작성하지 않았어요` : s.label}
                  className={`flex h-full w-full flex-col items-center justify-center rounded-md px-0.5 py-1.5 text-center leading-tight disabled:cursor-not-allowed ${color} ${current ? "font-bold shadow-sm" : "font-medium"}`}
                >
                  <span className="text-[10px] opacity-75">{i + 1}{state === "error" ? " ⚠" : ""}</span>
                  <span className="w-full truncate text-[12px] tracking-tighter md:text-[11px] lg:text-[12px]">{s.label}</span>
                </button>
              </li>
            );
          })}
        </ol>
        {restoredNote && <p className="rounded-lg bg-blue-50 p-2 text-xs text-blue-800">{restoredNote}</p>}
      </div>

      {stepKey === "type" && (
        <TypeStep
          value={doc.basic.type}
          onNext={(type) => {
            setDoc((d) => void (d.basic.type = type));
            goIndex(1);
          }}
          onLoadSample={
            isNew && !designId
              ? () => {
                  if (doc.basic.name && !confirm("작성 중인 내용 대신 예시를 불러올까요?")) return;
                  commit(sampleSubject());
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
          designId={designId}
          schoolYear={doc.application.startYear}
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
          onSave={save ? async () => save() : undefined}
          onDownloaded={() => onDownloaded?.(doc)}
        />
      )}
    </div>
  );
}
