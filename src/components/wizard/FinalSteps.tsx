"use client";

import { useState } from "react";
import { Packer } from "docx";
import { TEACHER_PLANS, TEXTBOOK_TYPES, type DesignDoc } from "@/domain/types";
import { applicationTexts } from "@/domain/summary";
import { codeMap } from "@/domain/codes";
import { buildDesignDocx, docxFileName } from "@/export/docx";
import { bandStatus, checkKey, isViewGrade, viewYears, type DesignBrief } from "@/domain/hoursView";
import { useHourChecks } from "../hours/useHourChecks";
import { checkApplication, checklistResults, validateDesign } from "@/validation/design";
import type { Issue, StepKey } from "@/validation/types";
import type { StepProps } from "./DocSteps";
import { Card, Field, IssueList, NavButtons, StepHeader, StepIssues, inputClass, toggle } from "../ui";

// ───────────── 계획서(서식1)·신청서(서식3) 항목 ─────────────
export function ApplicationStep({ doc, setDoc, onBack, onNext }: StepProps) {
  const subject = doc.basic.type === "subject";
  const a = doc.application;
  const t = applicationTexts(doc);
  const set = <K extends keyof DesignDoc["application"]>(k: K, v: DesignDoc["application"][K]) => setDoc((d) => void (d.application[k] = v));

  return (
    <div className="space-y-4">
      <StepHeader
        title={subject ? "고시 외 과목 신설 승인 신청서 항목 (서식3)" : "학교자율시간 활동 계획서 항목 (서식1)"}
        tips={[
          "앞 단계에서 쓴 내용으로 개설 필요성·목표·내용이 자동으로 채워져요. 고치고 싶으면 칸에 직접 쓰세요.",
        ]}
      />
      <Card className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="학교명">
            <input className={inputClass} value={a.schoolName} placeholder="○○초등학교" onChange={(e) => set("schoolName", e.target.value)} />
          </Field>
          {subject ? (
            <Field label="설립 구분">
              <select className={inputClass} value={a.establishment} onChange={(e) => set("establishment", e.target.value)}>
                {["국립", "공립", "사립", "기관"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
          ) : (
            <Field label="적용 시작 학년도">
              <p className="rounded-lg bg-gray-50 px-3 py-2 text-gray-700">{a.startYear}학년도 <span className="text-sm text-gray-500">(기본 정보에서 바꿀 수 있어요)</span></p>
            </Field>
          )}
        </div>
        {subject && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="영문 과목명">
              <input className={inputClass} value={a.englishName} onChange={(e) => set("englishName", e.target.value)} />
            </Field>
            <Field label="적용 시작 학년도">
              <p className="rounded-lg bg-gray-50 px-3 py-2 text-gray-700">{a.startYear}학년도 <span className="text-sm text-gray-500">(기본 정보에서 바꿀 수 있어요)</span></p>
            </Field>
          </div>
        )}
      </Card>

      <Card className="space-y-4">
        <h2 className="font-bold">{subject ? "과목" : "활동"} — 개설 필요성 · 목표 · 내용</h2>
        {(
          [
            ["necessity", "개설 필요성", t.autoNecessity],
            ["goalSummary", "목표", t.autoGoal],
            ["contentSummary", "내용", t.autoContent],
          ] as const
        ).map(([key, label, auto]) => (
          <Field key={key} label={label} hint={a[key] ? "직접 쓴 내용이 문서에 들어가요. 비우면 자동 작성으로 돌아가요." : "자동으로 채운 내용이에요. 고치려면 그대로 수정하세요."}>
            <textarea rows={4} className={inputClass} value={a[key] || auto} onChange={(e) => set(key, e.target.value === auto ? "" : e.target.value)} />
          </Field>
        ))}
      </Card>

      <Card className="space-y-4">
        <h2 className="font-bold">교재 활용 계획</h2>
        <div className="space-y-1">
          {TEXTBOOK_TYPES[doc.basic.type].map((x) => (
            <label key={x} className="flex items-center gap-2 text-sm">
              <input type="radio" name="textbook" checked={a.textbookType === x} onChange={() => set("textbookType", x)} />
              {x}
            </label>
          ))}
        </div>
        <Field label="교재/자료명 (선택)" hint="정해 둔 교재나 자료가 있으면 적어요. 비워도 돼요.">
          <input className={inputClass} value={a.textbookName} onChange={(e) => set("textbookName", e.target.value)} />
        </Field>
        <h2 className="font-bold">지도교사 확보 방안</h2>
        <div className="space-y-1">
          {TEACHER_PLANS.map((x) => (
            <label key={x} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={a.teacherPlans.includes(x)} onChange={() => set("teacherPlans", toggle(a.teacherPlans, x))} />
              {x}
            </label>
          ))}
        </div>
        <Field label="기타 특이사항 (선택)">
          <textarea rows={2} className={inputClass} value={a.etc} onChange={(e) => set("etc", e.target.value)} />
        </Field>
      </Card>
      <StepIssues issues={checkApplication(doc)} />
      <NavButtons onBack={onBack} onNext={onNext} />
    </div>
  );
}

// ───────────── 최종 점검 · 체크리스트 · 내려받기 ─────────────
export function FinalStep({
  doc,
  setDoc,
  onBack,
  goTo,
  stepLabel,
  onSave,
  onDownloaded,
  designId,
}: StepProps & {
  designId?: string;
  goTo: (step: StepKey) => void;
  stepLabel: (step?: StepKey) => string;
  onSave?: () => Promise<void>;
  onDownloaded?: () => void;
}) {
  const issues = validateDesign(doc).filter((i) => i.field !== "체크리스트");
  const errors = issues.filter((i) => i.level === "error");
  const checklist = checklistResults(doc);
  const [busy, setBusy] = useState(false);
  // 체크리스트를 모두 점검·체크해야 문서를 만들 수 있다 (사용자 결정, 2026-10-31)
  const unchecked = checklist.filter((c) => !c.ok);
  // 시수 점검: 학년군의 두 학년 화면이 모두 이상없음이어야 편성표가 붙는다. 안 했어도 문서는 내려받되 붙임 자리에 빨간 안내 (사용자 결정, 2026-10-30)
  const hc = useHourChecks();
  const current: DesignBrief = { id: designId ?? "current", name: doc.basic.name, grade: doc.basic.grade, semester: doc.basic.semester, hours: doc.basic.hours, subjectGroup: doc.basic.subjectGroup, schoolYear: doc.application.startYear };
  const year = Number(doc.application.startYear) || 2027;
  const briefs = [...hc.designs.filter((d) => d.id !== current.id), current];
  const hours = bandStatus(doc.basic.grade, year, hc.checks, briefs);
  const ownView = isViewGrade(doc.basic.grade) ? hc.checks[checkKey(year, doc.basic.grade)] : undefined;
  // 로그인하지 않은 체험: 문서를 내려받을 수 없다 (사용자 결정, 2026-10-30)
  const guest = !!hc.me?.enabled && !hc.loggedIn;
  const blocked = unchecked.length > 0 || guest;
  const goHours = async (grade: number) => {
    if (onSave) await onSave().catch(() => {});
    window.location.href = `/hours?grade=${grade}&year=${year}`;
  };

  const FORM_NOTICE = "내려받는 문서는 교육청에서 제공하는 양식과 다를 수 있습니다.\n한글(HWP)에서 열어 양식을 다듬어 쓰세요.";
  const download = async () => {
    if (blocked) return;
    if (!confirm(`${FORM_NOTICE}\n\n확인을 누르면 내려받습니다.`)) return;
    if (errors.length > 0 && !confirm(`아직 오류가 ${errors.length}개 있습니다. 그래도 문서를 내려받을까요?`)) return;
    setBusy(true);
    try {
      const blob = await Packer.toBlob(
        buildDesignDocx(
          doc,
          hours.complete && ownView
            ? { input: ownView.input, years: viewYears(ownView.grade, ownView.schoolYear), grade: ownView.grade, schoolYear: ownView.schoolYear }
            : { pending: true, grade: doc.basic.grade },
        ),
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = docxFileName(doc);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      onDownloaded?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <StepHeader title="최종 점검 · 내려받기">
        <div className="flex flex-wrap gap-3 pt-2">
          <span className={`rounded-full px-3 py-1 text-sm font-semibold ${errors.length ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
            오류 {errors.length}개
          </span>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-700">확인 필요 {issues.length - errors.length}개</span>
          <span className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-600">
            체크리스트 {checklist.filter((c) => c.ok).length}/{checklist.length}
          </span>
        </div>
      </StepHeader>

      <Card className="space-y-3">
        <h2 className="font-bold">① 지침 점검 결과</h2>
        <IssueList issues={issues} onGo={(i: Issue) => i.step && goTo(i.step)} stepLabel={(i) => stepLabel(i.step)} />
      </Card>

      <Card className="space-y-3">
        <h2 className="font-bold">② {doc.basic.type === "subject" ? "[서식7] 과목" : "[서식6] 활동"} 개설 체크리스트</h2>
        <p className="text-sm text-gray-600">&lsquo;자동&rsquo; 항목은 프로그램 점검 결과로 정해져요. 나머지는 직접 확인하고 표시해 주세요.</p>
        <ul className="divide-y divide-gray-100">
          {checklist.map((c) => (
            <li key={c.id} className="flex items-start gap-3 py-2 text-sm">
              {c.auto ? (
                <span className={`mt-0.5 w-10 shrink-0 rounded text-center text-xs font-bold ${c.ok ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                  {c.ok ? "○" : "X"}
                </span>
              ) : (
                <input
                  type="checkbox"
                  className="mt-1 ml-3 mr-2.5 h-4 w-4 shrink-0"
                  checked={c.ok}
                  onChange={() => setDoc((d) => void (d.checklist[c.id] = !d.checklist[c.id]))}
                />
              )}
              <span className={c.ok ? "" : "text-red-700"}>
                <span className="text-gray-400">[{c.area}]</span> {c.label}
                {c.auto && <span className="ml-1 text-xs text-gray-400">(자동)</span>}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-bold">③ 문서 내려받기</h2>
        <p className="text-sm text-gray-600">
          {doc.basic.type === "subject"
            ? "[서식3] 신청서 + [서식4] 과목 교육과정 + [서식7] 체크리스트"
            : "[서식1] 활동 계획서 + [서식2] 활동 교육과정 + [서식6] 체크리스트"}
          {" + 붙임: 교육과정 편성표(시수 점검표)"}
        </p>
        <div className={`space-y-2 rounded-lg border p-3 text-sm ${hours.complete ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-700"}`}>
          {hours.complete ? (
            <p className="font-semibold">✓ 시수 점검 완료 — {doc.basic.grade}학년 시수 점검표가 문서 끝에 함께 들어가요.</p>
          ) : (
            <>
              <p className="font-semibold">⚠ 시수 점검을 마쳐야 문서가 완성됩니다.</p>
              <p>지금 내려받으면 붙임(편성표) 자리에 &lsquo;시수 점검을 마쳐야 표시됩니다&rsquo;라는 빨간 안내가 들어가요.</p>
              <p>
                {hours.views.map((v) => `${v.grade}학년 화면: ${v.ok ? "이상없음" : v.saved ? "점검 필요" : "아직 안 함"}`).join(" · ")}
                {" "}— 학년군의 두 학년 화면이 모두 이상없음이어야 해요.
              </p>
              {hours.gradesWithoutDesign.length > 0 && (
                <p>
                  {hours.gradesWithoutDesign.join("·")}학년은 설계 현황에 설계가 없어 시수 점검에 자동으로 들어가지 않아요. 시수 점검 화면에서 {hours.gradesWithoutDesign.join("·")}학년 학교자율시간을 직접 입력해 주세요.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {hours.views
                  .filter((v) => !v.ok)
                  .map((v) => (
                    <button
                      key={v.grade}
                      type="button"
                      onClick={() => void goHours(v.grade)}
                      className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700"
                    >
                      ⚠ {v.grade}학년 시수 점검하기
                    </button>
                  ))}
              </div>
            </>
          )}
        </div>
        {guest && (
          <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
            ⚠ 로그인하지 않아 문서를 내려받을 수 없어요. 로그인한 뒤 「새 설계」를 열면 이 브라우저에 임시 저장된 내용이 이어져요.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={download} disabled={busy || blocked} className="rounded-lg bg-brand-600 px-5 py-2 font-semibold text-white hover:bg-brand-700 disabled:bg-gray-300">
            {busy ? "만드는 중…" : "📄 문서 내려받기 (.docx)"}
          </button>
          {onSave && (
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onSave();
                } finally {
                  setBusy(false);
                }
              }}
              className="rounded-lg border-2 border-brand-600 px-5 py-2 font-semibold text-brand-700 hover:bg-brand-50"
            >
              💾 저장하기
            </button>
          )}
        </div>
        {unchecked.length > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <p className="font-semibold">⚠ 체크리스트 내용을 모두 점검하고 체크해야 문서가 만들어집니다. (남은 항목 {unchecked.length}개)</p>
          </div>
        )}
      </Card>

      <DocPreview doc={doc} />
      <NavButtons onBack={onBack} />
    </div>
  );
}

/** 간단한 문서 미리보기 (교육과정 문서 본문) */
export function DocPreview({ doc }: { doc: DesignDoc }) {
  const codes = codeMap(doc);
  const subject = doc.basic.type === "subject";
  return (
    <Card className="space-y-4 text-sm">
      <h2 className="font-bold">④ 미리보기</h2>
      <div className="space-y-4 rounded-xl border border-gray-200 p-5">
        <p className="text-center text-lg font-bold">「{doc.basic.name}」</p>
        <section>
          <p className="font-bold">1. {subject ? "성격" : "필요성 및 목표"}</p>
          {doc.intro.rationale.split("\n").filter(Boolean).map((p, i) => (
            <p key={i} className="indent-2 text-gray-700">{p}</p>
          ))}
          {!subject && <Goals doc={doc} />}
        </section>
        {subject && (
          <section>
            <p className="font-bold">2. 목표</p>
            <Goals doc={doc} />
          </section>
        )}
        <section className="space-y-2">
          <p className="font-bold">{subject ? 3 : 2}. 내용 체계</p>
          <p className="text-gray-700">{doc.coreIdeas.map((s) => `⋅${s}`).join(" ")}</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border text-xs">
              <thead className="bg-brand-50">
                <tr>
                  <th className="border p-1">범주</th>
                  {doc.areas.map((a, i) => (
                    <th key={i} className="border p-1">({i + 1}) {a.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(["knowledge", "process", "values"] as const).map((c) => (
                  <tr key={c}>
                    <td className="border p-1 text-center font-semibold">{{ knowledge: "지식·이해", process: "과정·기능", values: "가치·태도" }[c]}</td>
                    {doc.areas.map((a, i) => (
                      <td key={i} className="whitespace-pre-line border p-1">{a[c].filter(Boolean).map((e) => `· ${e}`).join("\n")}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section>
          <p className="font-bold">{subject ? 4 : 3}. 성취기준</p>
          {doc.standards.map((s) => (
            <p key={s.id} className="text-gray-700">
              <span className="font-mono text-brand-700">{codes.get(s.id)}</span> {s.text}
            </p>
          ))}
        </section>
        <p className="text-xs text-gray-400">단원 지도계획·평가 계획 표는 내려받은 문서에서 확인하세요.</p>
      </div>
    </Card>
  );
}

function Goals({ doc }: { doc: DesignDoc }) {
  return (
    <div className="mt-1 text-gray-700">
      <p>{doc.intro.overallGoal}</p>
      {doc.intro.detailGoals.filter(Boolean).map((g, i) => (
        <p key={i} className="pl-3">({i + 1}) {g}</p>
      ))}
    </div>
  );
}
