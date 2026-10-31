"use client";

import { useLayoutEffect, useRef } from "react";
import { CATEGORIES, CATEGORY_KEYS, newId, standardNeedsRewrite, type Area, type DesignDoc, type Standard } from "@/domain/types";
import { CATEGORY_STYLE } from "../categoryStyle";
import { categoryOf, codeMap, hasSameCategory, standardCategories } from "@/domain/codes";
import { categoryCounts, categorySplit, elementCount, recommendedStandardCount, splitProblem, standardCountRange, standardCountsFor } from "@/domain/standardCounts";
import { contentSystemPrompt, coreIdeasPrompt, introPrompt, reviseStandardsPrompt, standardsPrompt, teachingPrompt } from "@/prompts/steps";
import { checkContentSystem, checkCoreIdeas, checkIntro, checkStandards, checkTeaching } from "@/validation/design";
import { manualAreas, manualCoreIdeas, manualStandards, manualTeaching } from "@/domain/manual";
import { AiAssist } from "./AiAssist";
import { Card, Chips, Field, ListEditor, NavButtons, StepHeader, StepIssues, inputClass, toggle } from "../ui";

export interface StepProps {
  doc: DesignDoc;
  setDoc: (fn: (d: DesignDoc) => void) => void;
  onBack: () => void;
  onNext: () => void;
  onParseFail?: (step: string, error: string) => void;
}

const emptyArea = (): Area => ({ name: "", knowledge: [""], process: [""], values: [""] });
const clean = (xs: string[]) => xs.map((s) => s.trim()).filter(Boolean);

// ───────────── ③ 내용 체계 (PPT 44~46쪽) ─────────────
export function ContentStep({ doc, setDoc, onBack, onNext, onParseFail }: StepProps) {
  return (
    <div className="space-y-4">
      <StepHeader
        title="내용 체계표 작성"
        tips={[
          "내용 체계: 교육과정의 범위와 수준으로 무엇을 가르치고 배울지를 제시한 것",
          "영역별로 구분하여 작성 (명사형, 영역 2~3개 권장)",
          "지식·이해: 명사형  예) (X) 평화의 중요성 알기 → (O) 평화의 중요성",
          "과정·기능: '~하기'  예) 탐구하기, 자료수집하기, 비교·분석하기, 발표하기, 제작하기",
          "가치·태도: 명사형  예) 태도, 흥미, 인식, 자세, 실천, 배려, 존중, 호기심, 어울림",
          "학습 내용들을 포괄하도록 작성하고, 특정 브랜드나 지역명은 쓰지 않아요",
        ]}
      />
      <AiAssist
        doc={doc}
        step={contentSystemPrompt}
        hasContent={doc.areas.some((a) => a.name.trim())}
        onParseFail={(e) => onParseFail?.("content", e)}
        onApply={(areas) => setDoc((d) => void (d.areas = areas))}
        onManual={() => setDoc((d) => void (d.areas = manualAreas(d)))}
        onReset={() => setDoc((d) => void (d.areas = []))}
      />
      <ContentTable doc={doc} setDoc={setDoc} />
      <StepIssues issues={checkContentSystem(doc.areas.map((a) => ({ ...a, knowledge: clean(a.knowledge), process: clean(a.process), values: clean(a.values) })))} />
      <NavButtons onBack={onBack} onNext={onNext} />
    </div>
  );
}

/** 내용 체계표: 예시 문서처럼 영역은 오른쪽으로, 범주는 아래로 (지식·이해 → 과정·기능 → 가치·태도) */
function ContentTable({ doc, setDoc }: Pick<StepProps, "doc" | "setDoc">) {
  const removeArea = (i: number) =>
    confirm("이 영역을 삭제할까요? 이 영역의 성취기준도 함께 삭제됩니다.") &&
    setDoc((d) => {
      d.areas.splice(i, 1);
      d.standardCounts?.splice(i, 1);
      d.standards = d.standards.filter((s) => s.areaIndex !== i).map((s) => (s.areaIndex > i ? { ...s, areaIndex: s.areaIndex - 1 } : s));
    });
  const addArea = () => setDoc((d) => void d.areas.push(emptyArea()));
  const th = "border border-gray-300 bg-gray-100 p-2 text-sm font-semibold";
  const placeholder = { knowledge: "명사형", process: "~하기", values: "~태도, ~의지" } as const;

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold">내용 체계표</h2>
        <button type="button" onClick={addArea} className="rounded-lg border border-brand-500 px-3 py-1 text-sm font-semibold text-brand-700 hover:bg-brand-50">
          + 영역 추가 (오른쪽에 열 추가)
        </button>
      </div>
      {doc.areas.length === 0 ? (
        <p className="rounded-lg bg-gray-50 p-4 text-center text-sm text-gray-500">
          위의 &lsquo;AI에게 초안 받기&rsquo;로 채우거나 &lsquo;+ 영역 추가&rsquo;를 눌러 직접 작성하세요.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse" style={{ minWidth: 120 + doc.areas.length * 240 }}>
            <thead>
              <tr>
                <th rowSpan={2} className={`${th} w-24`}>범주</th>
                <th colSpan={doc.areas.length} className={th}>내용 요소</th>
              </tr>
              <tr>
                {doc.areas.map((a, i) => (
                  <th key={i} className={`${th} align-top`}>
                    <div className="flex items-center gap-1">
                      <span className="shrink-0 text-brand-700">({i + 1})</span>
                      <input
                        className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-center font-semibold focus:border-brand-500 focus:outline-none"
                        value={a.name}
                        placeholder="영역 이름 (명사형)"
                        onChange={(e) => setDoc((d) => void (d.areas[i].name = e.target.value))}
                      />
                      <button type="button" title="영역 삭제" onClick={() => removeArea(i)} className="shrink-0 px-1 text-xs font-normal text-gray-400 hover:text-red-600">
                        삭제
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CATEGORY_KEYS.map((c) => (
                <tr key={c}>
                  <th className={`border border-gray-300 p-2 text-sm font-semibold whitespace-nowrap ${CATEGORY_STYLE[c].head}`}>{CATEGORIES[c]}</th>
                  {doc.areas.map((a, i) => (
                    <td key={i} className={`border border-gray-300 p-2 align-top ${CATEGORY_STYLE[c].cell}`}>
                      <CellList
                        boxClass={CATEGORY_STYLE[c].box}
                        items={a[c]}
                        placeholder={placeholder[c]}
                        onChange={(items) => setDoc((d) => void (d.areas[i][c] = items))}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/** 글 길이에 맞춰 높이가 저절로 늘어나는 입력 칸 */
function AutoTextarea({ value, placeholder, onChange, className = "border-transparent hover:border-gray-200" }: { value: string; placeholder: string; onChange: (v: string) => void; className?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={1}
      className={`w-full resize-none overflow-hidden rounded border px-1.5 py-1 text-sm focus:border-brand-500 focus:outline-none ${className}`}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/** 표 칸 안의 내용 요소 목록: 한 줄에 하나, 앞에 · 표시 */
function CellList({ items, onChange, placeholder, boxClass }: { items: string[]; onChange: (items: string[]) => void; placeholder: string; boxClass?: string }) {
  return (
    <div className="space-y-1">
      {items.map((v, j) => (
        <div key={j} className="flex items-start gap-1">
          <span className="pt-1.5 text-gray-400">·</span>
          <AutoTextarea
            className={boxClass}
            value={v}
            placeholder={placeholder}
            onChange={(t) => onChange(items.map((x, k) => (k === j ? t.replace(/\n/g, "") : x)))}
          />
          <button type="button" aria-label="삭제" className="px-1 pt-1 text-xs text-gray-300 hover:text-red-600" onClick={() => onChange(items.filter((_, k) => k !== j))}>
            ✕
          </button>
        </div>
      ))}
      <button type="button" className="pl-3 text-xs font-semibold text-brand-600 hover:underline" onClick={() => onChange([...items, ""])}>
        + 추가
      </button>
    </div>
  );
}

// ───────────── ④ 핵심아이디어 (PPT 47쪽) ─────────────
export function CoreIdeasStep({ doc, setDoc, onBack, onNext, onParseFail }: StepProps) {
  return (
    <div className="space-y-4">
      <StepHeader
        title="핵심아이디어 작성"
        tips={[
          "학습을 통해 일반화할 수 있는 내용을 핵심적으로 진술한 것 (학습의 초점, 깊이 있는 학습의 토대)",
          "주요 개념과 관련 개념을 연결하고, 학생들이 탐구를 통하여 발견해야 하는 진술문 형태로 작성",
          "영역의 수 ≒ 핵심아이디어의 수",
          "당위적 표현(~해야 한다)과 낱말 풀이식 진술은 피해요. 좋은 예) 문화는 예술을 통하여 가치와 신념이 표현된다.",
        ]}
      >
        <div className="rounded-lg bg-gray-50 p-3 text-sm">
          <p className="mb-1 font-semibold">확정한 영역</p>
          {doc.areas.map((a, i) => (
            <p key={i}>
              ({i + 1}) {a.name}
            </p>
          ))}
        </div>
      </StepHeader>
      <AiAssist
        doc={doc}
        step={coreIdeasPrompt}
        hasContent={doc.coreIdeas.some((s) => s.trim())}
        onParseFail={(e) => onParseFail?.("coreIdeas", e)}
        onApply={(ideas) => setDoc((d) => void (d.coreIdeas = ideas))}
        onManual={() => setDoc((d) => void (d.coreIdeas = manualCoreIdeas(d)))}
        onReset={() => setDoc((d) => void (d.coreIdeas = []))}
      />
      <Card>
        <ListEditor items={doc.coreIdeas} onChange={(items) => setDoc((d) => void (d.coreIdeas = items))} placeholder="~다." multiline addLabel="+ 핵심아이디어 추가" />
      </Card>
      <StepIssues issues={checkCoreIdeas(doc.coreIdeas, doc.areas.length)} />
      <NavButtons onBack={onBack} onNext={onNext} />
    </div>
  );
}

// ───────────── ⑤ 성취기준 (PPT 48~49쪽) ─────────────
export function StandardsStep({ doc, setDoc, onBack, onNext, onParseFail }: StepProps) {
  // 약어는 선생님이 꼭 정한다 (자동으로 채우지 않음). 비어 있는 동안 코드 미리보기는 ○○
  const abbrev = doc.abbrev || "○○";
  const codes = codeMap({ ...doc, abbrev });
  const allElements = (a: Area) => [...clean(a.knowledge), ...clean(a.process), ...clean(a.values)];

  return (
    <div className="space-y-4">
      <StepHeader
        title="성취기준 작성"
        tips={[
          "성취기준: 학습을 통해 학생에게 궁극적으로 기대하는 결과 혹은 도달점",
          "영역별로 2가지 이상 개발",
          "내용 요소는 서로 다른 범주끼리 묶어요: 2개면 서로 다른 두 범주, 3개면 [지식·이해]+[과정·기능]+[가치·태도] (같은 범주끼리 묶기 ✕)",
          "문장 끝은 '~한다.'처럼 써요. '~할 수 있다.'로 끝내지 않아요 (예: 만들 수 있다. → 만든다.)",
          doc.basic.type === "activity"
            ? "활동은 기존 교과 성취기준을 재구조화할 수 있어요 (그대로 옮겨 쓰기는 안 돼요)"
            : "과목은 새로운 성취기준을 개발해요",
          "코드 번호는 자동으로 붙어요: [편성학년][편성교과 첫 글자][과목명 약어][영역 순서]-[영역 내 순서]",
        ]}
      >
        <Field label="성취기준 코드에 쓸 과목명 약어 (2~3자)" hint={`코드 예: [${doc.basic.grade}${doc.basic.subjectGroup.charAt(0)}${abbrev}01-01]`}>
          <input
            id="abbrev"
            className={`${inputClass} max-w-40 ${doc.abbrev ? "" : "border-red-300"}`}
            value={doc.abbrev}
            placeholder="예: 지구"
            onChange={(e) => setDoc((d) => void (d.abbrev = e.target.value.trim()))}
          />
        </Field>
      </StepHeader>
      <StandardCountPicker doc={doc} setDoc={setDoc} />
      {doc.standards.some(standardNeedsRewrite) && (
        <AiAssist
          key={doc.standards.filter(standardNeedsRewrite).map((s) => s.id).join()}
          doc={{ ...doc, abbrev }}
          step={reviseStandardsPrompt}
          hasContent
          defaultOpen
          title={`바뀐 성취기준 문장 고치기 (${doc.standards.filter(standardNeedsRewrite).length}개)`}
          onParseFail={(e) => onParseFail?.("standards", e)}
          onApply={(rows) =>
            setDoc((d) => {
              for (const r of rows) {
                const st = d.standards.find((x) => x.id === r.id);
                if (st) {
                  st.text = r.text;
                  st.textFor = [...st.elements];
                }
              }
            })
          }
        />
      )}
      <AiAssist
        doc={{ ...doc, abbrev }}
        step={standardsPrompt}
        hasContent={doc.standards.length > 0}
        onParseFail={(e) => onParseFail?.("standards", e)}
        onApply={(standards) =>
          setDoc((d) => {
            d.standards = standards;
          })
        }
        onManual={() =>
          setDoc((d) => {
            d.standards = manualStandards(d);
          })
        }
        onReset={() => setDoc((d) => void (d.standards = []))}
      />
      {doc.areas.map((a, ai) => (
        <Card key={ai} className="space-y-3">
          <h2 className="font-bold">
            ({ai + 1}) {a.name}
          </h2>
          {doc.standards
            .filter((s) => s.areaIndex === ai)
            .map((s) => {
              const idx = doc.standards.findIndex((x) => x.id === s.id);
              const cats = standardCategories(doc.areas, s);
              const set = (fn: (st: Standard) => void) => setDoc((d) => fn(d.standards[idx]));
              return (
                <div key={s.id} className={`space-y-2 rounded-xl border p-3 ${standardNeedsRewrite(s) ? "border-amber-400 bg-amber-50/40" : "border-gray-200"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-sm font-bold text-brand-700">
                      {codes.get(s.id)}
                    </span>
                    <span className="text-xs text-gray-500">
                      결합 범주:{" "}
                      {cats.length
                        ? cats.map((c) => (
                            <span key={c} className={`ml-1 rounded px-1.5 py-0.5 ${CATEGORY_STYLE[c].badge}`}>
                              {CATEGORIES[c]}
                            </span>
                          ))
                        : "없음"}
                      <button
                        type="button"
                        className="ml-3 text-gray-400 hover:text-red-600"
                        onClick={() => setDoc((d) => void (d.standards = d.standards.filter((x) => x.id !== s.id)))}
                      >
                        삭제
                      </button>
                    </span>
                  </div>
                  {standardNeedsRewrite(s) && (
                    <p className="text-xs font-semibold text-amber-700">
                      ⚠ 내용 요소가 바뀌었어요 — 위쪽 &lsquo;바뀐 성취기준 문장 고치기&rsquo;로 AI에게 받거나 문장을 직접 고쳐 주세요.
                    </p>
                  )}
                  <textarea
                    rows={2}
                    className={inputClass}
                    value={s.text}
                    placeholder="~을 이해하고, ~한다."
                    onChange={(e) =>
                      set((st) => {
                        st.text = e.target.value;
                        st.textFor = [...st.elements]; // 직접 고친 문장은 지금 내용 요소에 맞춘 것으로 봄
                      })
                    }
                  />
                  <p className="text-xs text-gray-500">
                    이 성취기준이 다루는 내용 요소 2~3개, <b>서로 다른 범주</b>에서 하나씩 (눌러서 고르기 · 회색은 고를 수 없는 것, 마우스를 올리면 이유가 보여요)
                    {s.elements.length < 2 && <span className="ml-1 font-semibold text-red-600">— 2개 이상 골라 주세요 (지금 {s.elements.length}개)</span>}
                    {s.elements.length > 3 && <span className="ml-1 font-semibold text-red-600">— 3개까지예요 (지금 {s.elements.length}개)</span>}
                    {hasSameCategory(doc.areas, s.elements) && <span className="ml-1 font-semibold text-red-600">— 같은 범주끼리 묶였어요</span>}
                  </p>
                  <Chips
                    options={allElements(a)}
                    render={(o) => {
                      const c = categoryOf(doc.areas, o);
                      return (
                        <>
                          {c && <span className="mr-1 opacity-60">[{CATEGORIES[c].slice(0, 2)}]</span>}
                          {o}
                        </>
                      );
                    }}
                    tone={(o) => {
                      const c = categoryOf(doc.areas, o);
                      return c ? { on: CATEGORY_STYLE[c].chipOn, off: CATEGORY_STYLE[c].chipOff } : null;
                    }}
                    selected={s.elements}
                    disabled={(o) => {
                      const other = doc.standards.find((x) => x.id !== s.id && x.elements.includes(o));
                      if (other) return `${codes.get(other.id)}에서 사용 중`;
                      const c = categoryOf(doc.areas, o);
                      if (c && s.elements.some((e) => categoryOf(doc.areas, e) === c)) return `이미 ${CATEGORIES[c]} 내용 요소를 골랐어요 (서로 다른 범주끼리 묶어요)`;
                      if (s.elements.length >= 3) return "3개까지 묶을 수 있어요";
                      return false;
                    }}
                    onToggle={(o) =>
                      set((st) => {
                        if (!st.textFor && st.text.trim()) st.textFor = [...st.elements]; // 예전 저장본: 바꾸기 전 내용 요소를 기준으로
                        st.elements = toggle(st.elements, o);
                      })
                    }
                  />
                </div>
              );
            })}
          <button
            type="button"
            className="text-sm font-semibold text-brand-600 hover:underline"
            onClick={() => setDoc((d) => void d.standards.push({ id: newId(), areaIndex: ai, text: "", elements: [] }))}
          >
            + 이 영역에 성취기준 추가
          </button>
        </Card>
      ))}
      <StepIssues issues={checkStandards(doc)} />
      <NavButtons
        onBack={onBack}
        onNext={() => {
          // 약어가 비면 다음 단계로 못 넘어간다
          if (!doc.abbrev) {
            alert("성취기준 코드에 쓸 과목명 약어(2~3자)를 먼저 적어 주세요.");
            document.getElementById("abbrev")?.focus();
            return;
          }
          onNext();
        }}
      />
    </div>
  );
}

/** 영역별 성취기준 수 정하기 (내용 요소 수로 추천, 원하는 수로 바꾸기) */
function StandardCountPicker({ doc, setDoc }: Pick<StepProps, "doc" | "setDoc">) {
  const counts = standardCountsFor(doc);
  const set = (i: number, n: number | null) =>
    setDoc((d) => {
      const list = d.areas.map((_, k) => d.standardCounts?.[k] ?? null);
      list[i] = n;
      d.standardCounts = list;
    });
  const customized = doc.areas.some((_, i) => typeof doc.standardCounts?.[i] === "number");
  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold">영역별 성취기준 수 정하기</h2>
        {customized && (
          <button type="button" className="text-sm text-gray-500 underline" onClick={() => setDoc((d) => void (d.standardCounts = []))}>
            모두 추천대로
          </button>
        )}
      </div>
      <p className="text-sm text-gray-600">
        성취기준 하나에 서로 다른 범주의 내용 요소 2~3개를 묶고, 내용 요소는 한 번씩만 써요.
      </p>
      <div className="divide-y divide-gray-100">
        {doc.areas.map((a, i) => {
          const rec = recommendedStandardCount(a);
          const { min, max } = standardCountRange(a);
          const cc = categoryCounts(a);
          const problem = splitProblem(a);
          const split = categorySplit(a, counts[i]);
          return (
            <div key={i} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div className="text-sm">
                <b>
                  ({i + 1}) {a.name}
                </b>
                <span className="ml-2 text-gray-500">
                  내용 요소 {elementCount(a)}개 (지식·이해 {cc.knowledge} · 과정·기능 {cc.process} · 가치·태도 {cc.values}) →{" "}
                  {problem ? "묶을 수 없음" : `${min === max ? `${min}개만 가능` : `${min}~${max}개 가능`} (추천 ${rec}개)`}
                </span>
                {problem ? (
                  <p className="text-xs font-semibold text-red-600">⚠ {problem} 내용 체계 단계에서 내용 요소를 고쳐 주세요.</p>
                ) : (
                  split && <p className="text-xs text-gray-500">묶는 범주: {split.map((cs) => cs.map((c) => CATEGORIES[c]).join("+")).join(" / ")}</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button type="button" aria-label="줄이기" disabled={counts[i] <= min} onClick={() => set(i, counts[i] - 1)} className="h-8 w-8 rounded-lg border border-gray-300 text-lg leading-none disabled:opacity-30">
                  −
                </button>
                <span className={`w-14 text-center font-semibold ${counts[i] === rec ? "" : "text-brand-700"}`}>{counts[i]}개</span>
                <button type="button" aria-label="늘리기" disabled={counts[i] >= max} onClick={() => set(i, counts[i] + 1)} className="h-8 w-8 rounded-lg border border-gray-300 text-lg leading-none disabled:opacity-30">
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {counts.some((n) => n < 2) && (
        <p className="text-xs text-amber-700">지침은 영역별로 성취기준 2가지 이상 개발을 권장해요. 내용 요소가 4개 이상이면 2개 이상 만들 수 있어요.</p>
      )}
    </Card>
  );
}

// ───────────── ⑥ 필요성(성격) 및 목표 (PPT 50쪽) ─────────────
export function IntroStep({ doc, setDoc, onBack, onNext, onParseFail }: StepProps) {
  const subject = doc.basic.type === "subject";
  return (
    <div className="space-y-4">
      <StepHeader
        title={subject ? "성격 및 목표 작성" : "필요성 및 목표 작성"}
        tips={
          subject
            ? [
                "성격: 과목의 고유 성격 + 과목의 필요성 및 역할 + 기르고자 하는 역량",
                "총론의 '추구하는 인간상', '초등학교 교육목표'와 연계해 구체적으로",
                "목표: 총괄 목표 + 세부 목표 3가지(지식·이해, 과정·기능, 가치·태도)",
              ]
            : [
                "필요성: 사회현상 및 시대적 요구 + 학생들이 해당 활동을 배워야 하는 까닭 + 기르고자 하는 학생상 혹은 역량",
                "목표: 학생이 도달해야 할 도달점 — 총괄 목표 + 세부 목표 3가지(지식·이해, 과정·기능, 가치·태도)",
              ]
        }
      />
      <AiAssist
        doc={doc}
        step={introPrompt}
        hasContent={!!(doc.intro.rationale.trim() || doc.intro.overallGoal.trim() || doc.intro.detailGoals.some((g) => g.trim()))}
        onParseFail={(e) => onParseFail?.("intro", e)}
        onApply={(intro) => setDoc((d) => void (d.intro = intro))}
        onManual={() => {}}
        onReset={() => setDoc((d) => void (d.intro = { rationale: "", overallGoal: "", detailGoals: ["", "", ""] }))}
      />
      <Card className="space-y-4">
        <Field label={subject ? "성격" : "필요성"} hint="문단은 줄바꿈으로 나눠요">
          <textarea rows={8} className={inputClass} value={doc.intro.rationale} onChange={(e) => setDoc((d) => void (d.intro.rationale = e.target.value))} />
        </Field>
        <Field label="총괄 목표">
          <textarea rows={3} className={inputClass} value={doc.intro.overallGoal} onChange={(e) => setDoc((d) => void (d.intro.overallGoal = e.target.value))} />
        </Field>
        {["지식·이해", "과정·기능", "가치·태도"].map((c, i) => (
          <Field key={c} label={`세부 목표 (${i + 1}) ${c}`}>
            <input className={inputClass} value={doc.intro.detailGoals[i]} onChange={(e) => setDoc((d) => void (d.intro.detailGoals[i] = e.target.value))} />
          </Field>
        ))}
      </Card>
      <StepIssues issues={checkIntro(doc)} />
      <NavButtons onBack={onBack} onNext={onNext} />
    </div>
  );
}

// ───────────── (과목) 교수·학습 및 평가의 방향과 방법 ─────────────
export function TeachingStep({ doc, setDoc, onBack, onNext, onParseFail }: StepProps) {
  const parts = [
    ["teachingDirection", "교수·학습의 방향", "과목 목표 달성을 위한 교수·학습의 원칙과 중점"],
    ["teachingMethods", "교수·학습의 방법", "방향에 따라 활용할 교수·학습 방법이나 활용 상의 유의 사항"],
    ["assessDirection", "평가의 방향", "과목 목표를 달성하고 학습을 지원하기 위한 평가의 원칙과 중점 (과정 중심 평가 등)"],
    ["assessMethods", "평가의 방법", "평가 방법, 평가상의 유의점"],
  ] as const;
  return (
    <div className="space-y-4">
      <StepHeader title="교수·학습 및 평가의 방향과 방법 (과목)" tips={["과목 교육과정 문서(서식4)에 들어가는 항목이에요.", "각 항목은 '~한다.'로 끝나는 문장으로 써요."]} />
      <AiAssist
        doc={doc}
        step={teachingPrompt}
        hasContent={Object.values(doc.teaching).some((l) => l.length > 0)}
        onParseFail={(e) => onParseFail?.("teaching", e)}
        onApply={(t) => setDoc((d) => void (d.teaching = t))}
        onManual={() => setDoc((d) => void (d.teaching = manualTeaching()))}
        onReset={() => setDoc((d) => void (d.teaching = { teachingDirection: [], teachingMethods: [], assessDirection: [], assessMethods: [] }))}
      />
      {parts.map(([key, label, hint]) => (
        <Card key={key} className="space-y-2">
          <h2 className="font-bold">{label}</h2>
          <p className="text-xs text-gray-500">{hint}</p>
          <ListEditor items={doc.teaching[key]} onChange={(items) => setDoc((d) => void (d.teaching[key] = items))} multiline placeholder="~한다." />
        </Card>
      ))}
      <StepIssues issues={checkTeaching(doc)} />
      <NavButtons onBack={onBack} onNext={onNext} />
    </div>
  );
}
