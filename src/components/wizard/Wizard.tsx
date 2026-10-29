"use client";

import { useEffect, useState } from "react";
import type { BasicInfo, Plan, TopicInput } from "@/domain/types";
import { semesterHours } from "@/validation/hours";
import { TypeStep } from "./TypeStep";
import { BasicStep } from "./BasicStep";
import { TopicStep } from "./TopicStep";
import { PlansStep } from "./PlansStep";
import { EditStep } from "./EditStep";

const STEP_NAMES = ["유형 선택", "기본 정보", "주제와 내용", "AI 추천 3안", "고르고 고치기"];
const DRAFT_KEY = "sat-draft-v1";

export interface WizardState {
  step: number;
  basic: BasicInfo;
  input: TopicInput;
  plans: Plan[];
  demo: boolean;
  selected: Plan | null;
}

const initialState: WizardState = {
  step: 0,
  basic: {
    type: "activity",
    name: "",
    grade: 3,
    semester: 1,
    hours: semesterHours(3),
    subjectGroup: "사회",
    openingType: "학교 특색교육형",
    operationMode: "지속형",
  },
  input: { topic: "", requiredContents: [], desiredActivities: [], schoolContext: "", resources: "" },
  plans: [],
  demo: false,
  selected: null,
};

export function Wizard() {
  const [state, setState] = useState<WizardState>(initialState);
  const [loaded, setLoaded] = useState(false);

  // 작성 중인 내용을 이 브라우저에 임시 보관 (저장 기능은 5단계에서 DB로 연결)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) setState({ ...initialState, ...JSON.parse(raw) });
    } catch {
      /* 임시 보관을 못 읽어도 새로 시작하면 됨 */
    }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
    } catch {
      /* 저장 공간을 못 쓰는 환경이면 무시 */
    }
  }, [state, loaded]);

  const update = (patch: Partial<WizardState>) => setState((s) => ({ ...s, ...patch }));
  const go = (step: number) => {
    update({ step });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const reset = () => {
    if (confirm("작성 중인 내용을 모두 지우고 처음부터 시작할까요?")) setState(initialState);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ol className="flex flex-wrap gap-2 text-sm">
          {STEP_NAMES.map((name, i) => (
            <li key={name}>
              <button
                type="button"
                disabled={i > state.step}
                onClick={() => go(i)}
                className={`rounded-full px-3 py-1 ${
                  i === state.step
                    ? "bg-brand-600 font-semibold text-white"
                    : i < state.step
                      ? "bg-brand-100 text-brand-700 hover:bg-brand-50"
                      : "bg-gray-100 text-gray-400"
                }`}
              >
                {i + 1}. {name}
              </button>
            </li>
          ))}
        </ol>
        <button type="button" onClick={reset} className="text-sm text-gray-400 hover:text-red-600">
          처음부터 다시
        </button>
      </div>

      {state.step === 0 && (
        <TypeStep
          value={state.basic.type}
          onNext={(type) => {
            update({ basic: { ...state.basic, type } });
            go(1);
          }}
        />
      )}
      {state.step === 1 && (
        <BasicStep
          value={state.basic}
          onBack={() => go(0)}
          onNext={(basic) => {
            update({ basic });
            go(2);
          }}
        />
      )}
      {state.step === 2 && (
        <TopicStep
          basic={state.basic}
          value={state.input}
          onBack={() => go(1)}
          onNext={(input, plans, demo) => {
            update({ input, plans, demo, selected: null });
            go(3);
          }}
        />
      )}
      {state.step === 3 && (
        <PlansStep
          basic={state.basic}
          plans={state.plans}
          demo={state.demo}
          onBack={() => go(2)}
          onSelect={(plan) => {
            update({ selected: structuredClone(plan) });
            go(4);
          }}
        />
      )}
      {state.step === 4 && state.selected && (
        <EditStep
          basic={state.basic}
          plan={state.selected}
          onChange={(selected) => update({ selected })}
          onBack={() => go(3)}
        />
      )}
    </div>
  );
}
