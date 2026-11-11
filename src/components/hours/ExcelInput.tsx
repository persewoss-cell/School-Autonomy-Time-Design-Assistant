"use client";

import { useRef, useState } from "react";
import { buildAllocationXlsx } from "@/export/allocationXlsx";
import { planTemplateApply, readAllocationTemplate, type ApplyPlan } from "@/domain/allocationTemplate";
import { checkAllocation, maxCoursesPerSemester, type AllocationInput, type SemesterIndex } from "@/validation/allocation";
import { Modal } from "../Modal";
import { Card } from "../ui";
import { GUEST_LIMIT } from "../LoginGate";

const SEMS: SemesterIndex[] = [0, 1, 2, 3];
const MAX_BYTES = 3 * 1024 * 1024;

/**
 * 시수 점검 ①과 ② 사이: '엑셀로 편성표 입력하기' (사용자 요청, 2026-11-11)
 * 1) 입력 양식 받기 — 지금 ① 학교자율시간이 들어간 편성표 모양 엑셀. 받기 전 팝업으로 ① 상태를 꼭 확인
 * 2) 입력한 엑셀 올리기 — 맞는 양식인지 확인한 뒤, '지금 값이 모두 지워지고 바뀐다'는 팝업에서 확인해야 ②에 반영
 */
export function ExcelInput({
  a,
  grade,
  year,
  years,
  label,
  schoolName,
  guest,
  onApply,
  onFixFirst,
}: {
  a: AllocationInput;
  grade: number;
  year: number;
  years: [number, number, number, number];
  label: (s: SemesterIndex) => string;
  schoolName?: string;
  guest: boolean;
  onApply: (next: AllocationInput) => void;
  /** '① 먼저 고치기': ①로 이동 */
  onFixFirst: () => void;
}) {
  const [askDownload, setAskDownload] = useState(false);
  const [plan, setPlan] = useState<{ file: string; plan: ApplyPlan } | null>(null);
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const r = checkAllocation(a, years);
  // 양식을 받기 전에 알려 줄 ① 상태
  const courseWarnings: string[] = [];
  if (a.courses.length === 0) courseWarnings.push("① 학교자율시간 과목·활동을 하나도 추가하지 않았어요.");
  a.courses.forEach((c, i) => {
    if (!c.name.trim()) courseWarnings.push(`①의 ${i + 1}번째 과목·활동 이름이 비어 있어요.`);
    if (c.hours < 10) courseWarnings.push(`「${c.name || `${i + 1}번째`}」이(가) ${c.hours}시간이에요. (한 과목·활동은 10시간 이상)`);
  });
  for (const s of SEMS) {
    const h = r.autonomyBySemester[s];
    const n = a.courses.filter((c) => c.semester === s).length;
    if (h && h !== r.semesterTarget) courseWarnings.push(`${label(s)} 학교자율시간 합계가 ${h}시간이에요. (운영하는 학기는 ${r.semesterTarget}시간)`);
    if (n > maxCoursesPerSemester(a.band)) courseWarnings.push(`${label(s)}에 과목·활동이 ${n}개예요. (학기당 ${maxCoursesPerSemester(a.band)}개 이내)`);
  }

  const download = async () => {
    setAskDownload(false);
    const buf = await buildAllocationXlsx(a, { years, grade, schoolYear: year, schoolName }, { template: true });
    const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${year}학년도_${grade}학년_편성표_입력양식.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const upload = async (f: File | undefined) => {
    if (input.current) input.current.value = "";
    if (!f) return;
    setApplied("");
    if (!/\.xlsx$/i.test(f.name)) {
      setPlan({ file: f.name, plan: { ok: false, error: "엑셀 파일(.xlsx)만 올릴 수 있어요. 예전 .xls나 .csv, 한셀 파일은 엑셀에서 '.xlsx'로 저장해 올려 주세요.", problems: [] } });
      return;
    }
    if (f.size > MAX_BYTES) {
      setPlan({ file: f.name, plan: { ok: false, error: "파일이 너무 커요(3MB 넘음). 앱에서 받은 입력 양식에 숫자만 넣어 올려 주세요.", problems: [] } });
      return;
    }
    setBusy(true);
    try {
      const read = await readAllocationTemplate(await f.arrayBuffer());
      setPlan({ file: f.name, plan: read.ok ? planTemplateApply(a, { grade, schoolYear: year }, read.read, (s) => label(s as SemesterIndex)) : { ok: false, error: read.error, problems: [] } });
    } finally {
      setBusy(false);
    }
  };

  const btn = "rounded-lg border-2 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:border-gray-300 disabled:text-gray-400";
  return (
    <Card className="space-y-3">
      <h2 className="font-bold">엑셀로 편성표 입력하기 (선택)</h2>
      <ol className="list-decimal space-y-0.5 pl-5 text-sm text-gray-600">
        <li>
          위 <b>① 학교자율시간 과목·활동</b>을 먼저 맞춘 뒤 <b>입력 양식</b>을 받으세요. 양식에는 지금 ①이 그대로 들어가요.
        </li>
        <li>
          엑셀에서 <b className="bg-[#fff2cc] px-1">노란 칸</b>(교과·창체 학기별 편성 시수)만 입력하고 저장하세요. 증감·합계·판정은 엑셀에서도 바로 계산돼요.
        </li>
        <li>
          <b>입력한 엑셀 올리기</b>를 누르면, 확인 팝업 뒤에 아래 ② 편성표에 반영돼요.
        </li>
      </ol>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={guest} title={guest ? GUEST_LIMIT : undefined} onClick={() => setAskDownload(true)} className={`${btn} border-brand-600 text-brand-700 hover:bg-brand-50`}>
          📥 입력 양식 받기 (.xlsx)
        </button>
        <button type="button" disabled={guest || busy} title={guest ? GUEST_LIMIT : undefined} onClick={() => input.current?.click()} className={`${btn} border-sky-600 text-sky-700 hover:bg-sky-50`}>
          {busy ? "읽는 중…" : "📤 입력한 엑셀 올리기"}
        </button>
        <input ref={input} type="file" accept=".xlsx" className="hidden" onChange={(e) => void upload(e.target.files?.[0])} />
        {guest && <span className="text-xs font-semibold text-red-600">로그인해야 쓸 수 있어요.</span>}
      </div>
      {applied && <p className="rounded-lg bg-green-50 p-2 text-sm font-semibold text-green-800">✓ {applied}</p>}

      {askDownload && (
        <Modal
          title="입력 양식 받기 전에 확인해 주세요"
          tone={courseWarnings.length ? "amber" : "brand"}
          wide
          onClose={() => setAskDownload(false)}
          actions={
            <>
              <button
                type="button"
                onClick={() => {
                  setAskDownload(false);
                  onFixFirst();
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50"
              >
                ① 먼저 고치기
              </button>
              <button type="button" onClick={() => void download()} className="rounded-lg bg-brand-600 px-5 py-2 font-bold text-white hover:bg-brand-700">
                이 상태로 양식 받기
              </button>
            </>
          }
        >
          <p className="font-semibold">양식에는 지금 ① 학교자율시간 과목·활동이 그대로 들어가요.</p>
          {a.courses.length > 0 ? (
            <ul className="space-y-1 text-sm">
              {a.courses.map((c, i) => (
                <li key={i} className="rounded-lg bg-orange-50 px-3 py-1.5">
                  「{c.name || "이름 없음"}」 · {c.subjectKey} · {label(c.semester)} · {c.hours}시간
                </li>
              ))}
            </ul>
          ) : null}
          {courseWarnings.length > 0 && (
            <ul className="space-y-1">
              {courseWarnings.map((w) => (
                <li key={w} className="rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
                  ⚠ {w}
                </li>
              ))}
            </ul>
          )}
          {a.courses.length === 0 && (
            <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
              추가하지 않으면 <b>학교자율시간이 없는</b> 지금 ① 상태로만 양식이 만들어져요. 학교자율시간을 운영한다면 ①에 먼저 추가해 주세요.
            </p>
          )}
          <ul className="list-disc space-y-0.5 pl-5 text-sm text-gray-600">
            <li>양식을 받은 뒤 ①을 바꾸면 그 양식은 올릴 수 없어요. ①을 바꿨다면 양식을 다시 받아 주세요.</li>
            <li>학교자율시간(주황 줄)과 기준시수는 엑셀에서 고칠 수 없어요. 앱에서만 고쳐요.</li>
            <li>
              {year}학년도 {grade}학년 화면 전용 양식이에요. 다른 학년·학년도 화면에는 올릴 수 없어요.
            </li>
          </ul>
        </Modal>
      )}

      {plan && !plan.plan.ok && (
        <Modal
          title="엑셀을 반영하지 않았어요"
          onClose={() => setPlan(null)}
          wide={plan.plan.problems.length > 0}
          actions={
            <button type="button" onClick={() => setPlan(null)} className="rounded-lg bg-red-600 px-5 py-2 font-bold text-white hover:bg-red-700">
              닫기
            </button>
          }
        >
          <p className="text-sm text-gray-500">{plan.file}</p>
          <p className="font-semibold">{plan.plan.error}</p>
          {plan.plan.problems.length > 0 && (
            <ul className="max-h-64 space-y-1 overflow-y-auto">
              {plan.plan.problems.map((p) => (
                <li key={p} className="rounded-lg bg-red-50 p-2 text-sm text-red-800">
                  {p}
                </li>
              ))}
            </ul>
          )}
          <p className="text-sm text-gray-600">지금 ② 편성표는 바뀌지 않았어요.</p>
        </Modal>
      )}

      {plan && plan.plan.ok && (
        <Modal
          title="엑셀 값을 ② 편성표에 반영할까요?"
          tone="amber"
          wide
          onClose={() => setPlan(null)}
          actions={
            <>
              <button type="button" onClick={() => setPlan(null)} className="rounded-lg border border-gray-300 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50">
                닫기
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!plan.plan.ok) return;
                  onApply(plan.plan.next);
                  const after = checkAllocation(plan.plan.next, years).issues.filter((i) => i.level === "error").length;
                  setApplied(`엑셀 값을 반영했어요 (${plan.plan.changes.length}칸 바뀜). ${after ? `③ 점검 결과에 오류 ${after}건이 있어요.` : "③ 점검 결과도 확인해 주세요."}`);
                  setPlan(null);
                }}
                className="rounded-lg bg-red-600 px-5 py-2 font-bold text-white hover:bg-red-700"
              >
                반영하기
              </button>
            </>
          }
        >
          <p className="text-sm text-gray-500">{plan.file}</p>
          <p className="font-semibold text-red-700">
            반영하면 ② 교과·창체 편성표의 지금 값이 <u>모두 지워지고</u> 엑셀 값으로 바뀌어요.
          </p>
          <p className="text-sm text-gray-600">① 학교자율시간 과목·활동과 기준시수는 그대로예요. 반영한 뒤에도 앱에서 칸을 고칠 수 있어요.</p>
          {plan.plan.changes.length > 0 && (
            <div className="space-y-1">
              <p className="text-sm font-bold">바뀌는 칸 {plan.plan.changes.length}개</p>
              <div className="max-h-56 overflow-y-auto rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-100 text-xs text-gray-600">
                    <tr>
                      <th className="px-2 py-1 text-left">칸</th>
                      <th className="px-2 py-1">지금</th>
                      <th className="px-2 py-1">엑셀</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.plan.changes.map((c) => (
                      <tr key={c.where} className="border-t border-gray-100">
                        <td className="px-2 py-1">{c.where}</td>
                        <td className="px-2 py-1 text-center text-gray-500">{c.from}</td>
                        <td className="px-2 py-1 text-center font-semibold">{c.to}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {plan.plan.notes.length > 0 && (
            <ul className="space-y-1">
              {plan.plan.notes.map((n) => (
                <li key={n} className="rounded-lg bg-blue-50 p-2 text-sm text-blue-800">
                  ℹ️ {n}
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}
    </Card>
  );
}
