"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  VIEW_GRADES,
  viewHalves,
  carryWarnings,
  checkKey,
  checkOk,
  designDiff,
  importDesigns,
  initialCheck,
  isViewGrade,
  missingHalves,
  restoreHalf,
  schoolYearOf,
  semesterLabelWithYear,
  syncWithDesigns,
  viewYears,
  type Checks,
  type HourCheck,
  type ViewGrade,
} from "@/domain/hoursView";
import { useHourChecks } from "./useHourChecks";
import { AllocationFormTable } from "./AllocationFormTable";
import {
  bandInfo,
  autoReduce,
  checkAllocation,
  maxCoursesPerSemester,
  type AllocationInput,
  type SemesterIndex,
} from "@/validation/allocation";
import { Packer } from "docx";
import { buildAllocationDocx } from "@/export/allocationDocx";
import { buildAllocationXlsx } from "@/export/allocationXlsx";
import { Card, IssueList } from "../ui";
import { GuestBanner, GUEST_LIMIT } from "../LoginGate";

const SEMS: SemesterIndex[] = [0, 1, 2, 3];
const num = (v: string) => Math.max(0, Math.floor(Number(v) || 0));
const cell = "w-16 rounded border border-gray-300 px-1 py-1 text-right text-sm focus:border-brand-500 focus:outline-none";

export function HoursChecker() {
  const params = useSearchParams();
  const router = useRouter();
  const q = Number(params.get("grade"));
  const grade: ViewGrade = isViewGrade(q) ? q : 3;
  const { checks, designs, loaded, save, loggedIn, me } = useHourChecks();
  // 로그인하지 않은 체험: 점검은 되지만 이 브라우저에만 저장되고 문서는 못 받는다
  const guest = !!me?.enabled && !loggedIn;
  // 학년도: 주소에 있으면 그것, 없으면 가장 최근 설계 학년도(없으면 올해)
  const designYears = designs.map((d) => Number(d.schoolYear)).filter((y) => y > 2000);
  const thisYear = schoolYearOf(new Date());
  const qy = Number(params.get("year"));
  const year = qy > 2000 ? qy : designYears.length ? Math.max(...designYears) : thisYear;
  const yearOptions = Array.from(new Set([...designYears, thisYear, thisYear + 1, year])).sort();
  const yearChoices = Array.from({ length: Math.max(...yearOptions) + 2 - (Math.min(...yearOptions) - 1) }, (_, i) => Math.min(...yearOptions) - 1 + i);
  const key = checkKey(year, grade);
  const [check, setCheck] = useState<HourCheck | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [skipped, setSkipped] = useState<string[]>([]);

  // 화면을 열 때: 저장본이 있으면 그것, 없으면 그 학년도 설계 + 이전에 점검한 같은 학년·학년도 시수
  useEffect(() => {
    if (!loaded) return;
    setCheck(checks[key] ?? initialCheck(grade, year, designs, checks));
    setDirty(false);
    setSaveState(checks[key] ? "saved" : "idle");
    // checks는 저장할 때마다 바뀌므로 학년·학년도를 바꿀 때만 다시 불러온다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, loaded, designs]);

  // 아직 저장 안 된 고침: 화면을 바꾸거나 페이지를 떠날 때 바로 저장한다
  const pending = useRef<HourCheck | null>(null);
  pending.current = dirty ? check : null;
  useEffect(() => {
    const onHide = () => {
      if (pending.current) void save(pending.current, { keepalive: true });
    };
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      onHide(); // 다른 화면으로 이동할 때
    };
  }, [save]);
  const saveNow = async () => {
    if (!check) return;
    setSaveState("saving");
    try {
      await save(check);
      setDirty(false);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  };
  const go = async (g: ViewGrade, y: number) => {
    if (pending.current) await saveNow();
    pending.current = null;
    router.replace(`/hours?grade=${g}&year=${y}`);
  };

  // 고친 내용은 잠시 뒤 자동 저장
  useEffect(() => {
    if (!check || !dirty) return;
    const t = setTimeout(() => {
      setSaveState("saving");
      save(check)
        .then(() => {
          setSaveState("saved");
          setDirty(false);
        })
        .catch(() => setSaveState("error"));
    }, 500);
    return () => clearTimeout(t);
  }, [check, dirty, save]);

  if (!check) return <p className="text-gray-500">불러오는 중…</p>;
  const a = check.input;
  const setA = (next: AllocationInput) => {
    setCheck({ ...check, input: next });
    setDirty(true);
  };
  const replaceCheck = (next: HourCheck) => {
    setCheck(next);
    setDirty(true);
  };
  const info = bandInfo(a.band);
  const r = checkAllocation(a, viewYears(grade, year));
  const mutate = (fn: (x: AllocationInput) => void) => {
    const next = structuredClone(a);
    fn(next);
    setA(next);
  };
  const label = (s: SemesterIndex) => semesterLabelWithYear(grade, year, s);
  /** 편성표 내려받기: 한글용 .docx 또는 수식이 들어간 엑셀 .xlsx */
  const downloadForm = async (kind: "docx" | "xlsx") => {
    if (guest) return;
    const meta = { years: viewYears(grade, year), grade, schoolYear: year, schoolName: me?.user?.schoolName };
    const blob =
      kind === "docx"
        ? await Packer.toBlob(buildAllocationDocx(a, meta))
        : new Blob([await buildAllocationXlsx(a, meta)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${grade}학년_교육과정_편성표.${kind}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const errorCount = r.issues.length;
  const diff = designDiff(check, designs);
  const all: Checks = { ...checks, [key]: check };
  // 이 화면이 이상없음이면 화면에 든 두 학년(학년도) 설계가 모두 시수 점검 완료
  const viewOk = checkOk(check, designs);
  const halvesLabel = viewHalves(grade, year).map((h) => `${h.grade}학년(${h.year})`).join("·");
  const warnings = carryWarnings(check, checks);
  const missing = missingHalves(check, designs).filter((m) => !skipped.includes(`${key}-${m.half}`));

  return (
    <div className="space-y-5">
      {/* 상단 고정: 제목 · 학년도 설정 · 저장 */}
      <div className="sticky top-[53px] z-20 -mx-4 border-b border-gray-200 bg-[#f7f8f6]/95 px-4 py-2 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-lg font-bold">학교자율시간 시수 편성 점검</h1>
            <label className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-900">
              학년도 설정
              <select className="rounded border border-amber-300 bg-white px-2 py-0.5" value={year} onChange={(e) => void go(grade, Number(e.target.value))}>
                {yearChoices.map((y) => (
                  <option key={y} value={y}>
                    {y}학년도
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-xs text-gray-500">
              {!loggedIn ? <b className="text-red-600">로그인하지 않아 이 브라우저에만 저장 · </b> : ""}
              {saveState === "saving" ? "저장 중…" : saveState === "saved" ? "✓ 저장됨" : saveState === "error" ? "⚠ 저장 실패" : "아직 저장 안 됨"}
            </span>
            <button
              type="button"
              onClick={() => void saveNow()}
              className="rounded-lg border-2 border-brand-600 bg-white px-4 py-1.5 font-semibold text-brand-700 hover:bg-brand-50"
            >
              💾 저장
            </button>
          </div>
        </div>
      </div>

      <GuestBanner />

      <Card className="space-y-2">
        <ol className="list-decimal space-y-0.5 pl-5 text-sm text-gray-600">
          <li>학년도와 학년을 고릅니다.</li>
          <li>그 학년도 설계가 자동으로 들어가요. 같은 학년·학년도를 앞서 점검했다면 그 시수를 그대로 이어받아요.</li>
          <li>바꿀 계획이 있으면 추가·삭제·수정하세요. 교과별 편성 시수는 아래 편성표 칸에 넣습니다.</li>
          <li>이 화면이 이상없음이면 화면에 든 두 학년 설계의 시수 점검 완료!</li>
        </ol>
        <p className="text-xs text-gray-400">기준: 학교자율시간 시수 편성 점검표(엑셀) 계산식 · 증감 범위는 지침대로 교과(군) 단위</p>
      </Card>

      {/* 학년 버튼: 좌우로 꽉 차는 네모 버튼 4개 */}
      <div className="grid grid-cols-4 gap-2">
        {VIEW_GRADES.map((g) => {
          const c = all[checkKey(year, g)];
          const ok = checkOk(c, designs);
          const on = g === grade;
          return (
            <button
              key={g}
              type="button"
              onClick={() => void go(g, year)}
              className={`rounded-lg border-2 py-3 text-center font-bold transition ${
                on ? "border-brand-600 bg-brand-600 text-white" : "border-gray-200 bg-white text-gray-700 hover:border-brand-500"
              }`}
            >
              {g}학년
              <span className={`block text-xs font-semibold ${on ? "text-white/90" : ok ? "text-green-700" : c ? "text-red-600" : "text-gray-400"}`}>
                {ok ? "✓ 이상없음" : c ? "점검 필요" : "아직 안 함"}
              </span>
            </button>
          );
        })}
      </div>

      {/* 학년도 완료 상태 + 완료까지 할 일 (한 상자) */}
      <div className={`space-y-2 rounded-xl p-4 text-sm ${viewOk && missing.length === 0 ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-900"}`}>
        <p className="font-semibold">
          {viewOk
            ? `✓ ${halvesLabel} 시수 점검 완료 — 이 두 학년의 설계는 설계 현황에 '시수점검 완료'로 표시돼요.`
            : `${halvesLabel} 시수 점검 완료까지 할 일 (이 화면이 이상없음이면 완료)`}
        </p>
        {(!viewOk || missing.length > 0) && (
          <ul className="space-y-1.5">
            {missing.map((m) => (
              <li key={`m${m.half}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/70 px-3 py-2">
                <span>
                  <b>
                    {m.year}학년도 {m.grade}학년 설계가 없어요.
                  </b>{" "}
                  {m.fromYear ? `${m.fromYear}학년도 ${m.grade}학년 설계를 가져올까요? (가져온 뒤 고칠 수 있어요)` : "아래 ①에서 직접 입력해 주세요."}
                </span>
                <span className="flex gap-2">
                  {m.fromYear && (
                    <button
                      type="button"
                      className="rounded-lg bg-brand-600 px-3 py-1 font-semibold text-white hover:bg-brand-700"
                      onClick={() => {
                        replaceCheck(importDesigns(check, m.half, m.fromYear!, designs));
                        setSkipped((x) => [...x, `${key}-${m.half}`]);
                      }}
                    >
                      {m.fromYear}학년도 설계 가져오기
                    </button>
                  )}
                  <button
                    type="button"
                    className="rounded-lg border border-gray-300 bg-white px-3 py-1 font-semibold text-gray-700 hover:bg-gray-50"
                    onClick={() => setSkipped((x) => [...x, `${key}-${m.half}`])}
                  >
                    직접 입력할게요
                  </button>
                </span>
              </li>
            ))}
            {!viewOk && (
              <li className="rounded-lg bg-white/70 px-3 py-2">
                <b>{grade}학년 화면(지금 화면) 점검 필요</b> — 아래 ③ 점검 결과의 오류를 고쳐 주세요.
              </li>
            )}
          </ul>
        )}
      </div>

      {warnings.map((w) => (
        <div key={w.half} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p>⚠ {w.message} 바꾼 것이 맞다면 그대로 두셔도 돼요.</p>
          <button
            type="button"
            className="rounded-lg border border-amber-400 bg-white px-3 py-1.5 font-semibold text-amber-800 hover:bg-amber-100"
            onClick={() => replaceCheck(restoreHalf(check, w.half, w.source, w.sourceHalf))}
          >
            이전 점검 시수로 되돌리기
          </button>
        </div>
      ))}

      {diff.length > 0 && (
        <div className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">{year}학년도 설계와 다른 점이 있어요. 반영해야 이상없음이 돼요.</p>
          <ul className="list-disc pl-5">
            {diff.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
          <button type="button" className="rounded-lg bg-red-600 px-3 py-1.5 font-semibold text-white hover:bg-red-700" onClick={() => replaceCheck(syncWithDesigns(check, designs))}>
            설계 현황 반영하기 (직접 추가한 것은 그대로)
          </button>
        </div>
      )}

      <Card className="space-y-3">
        <h2 className="font-bold">① 학교자율시간 과목·활동</h2>
        <p className="text-sm text-gray-600">
          운영하는 학기는 합계가 <b>{r.semesterTarget}시간</b>(1주 분량)이어야 하고, 학년마다 한 학기 이상 운영합니다(2027학년도부터. 2026학년도는 학년군에 1개, 2025학년도는 학교에 1개 이상).
          한 과목·활동은 10시간 이상, 학기당 {maxCoursesPerSemester(a.band)}개 이내.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead className="text-left text-gray-500">
              <tr>
                <th className="p-1">과목·활동명</th>
                <th className="p-1">편성 교과</th>
                <th className="p-1">학년·학기</th>
                <th className="p-1">시수</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {a.courses.map((c, i) => (
                <tr key={i}>
                  <td className="p-1">
                    {c.designId && <span className="mr-1 rounded bg-brand-50 px-1.5 py-0.5 text-xs text-brand-700">설계</span>}
                    <input
                      className="w-[85%] rounded border border-gray-300 px-2 py-1"
                      value={c.name}
                      placeholder="예: 지구마을 첫걸음"
                      onChange={(e) => mutate((x) => (x.courses[i].name = e.target.value))}
                    />
                  </td>
                  <td className="p-1">
                    <select
                      className="rounded border border-gray-300 px-2 py-1"
                      value={c.subjectKey}
                      onChange={(e) => mutate((x) => (x.courses[i].subjectKey = e.target.value))}
                    >
                      {info.subjects.map((s) => (
                        <option key={s.key} value={s.key}>{s.key}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-1">
                    <select
                      className="rounded border border-gray-300 px-2 py-1"
                      value={c.semester}
                      onChange={(e) => mutate((x) => (x.courses[i].semester = Number(e.target.value) as SemesterIndex))}
                    >
                      {SEMS.map((s) => (
                        <option key={s} value={s}>{label(s)}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-1">
                    <input
                      type="number"
                      className={cell}
                      value={c.hours}
                      onChange={(e) => mutate((x) => (x.courses[i].hours = num(e.target.value)))}
                    />
                  </td>
                  <td className="p-1">
                    <button type="button" className="text-gray-400 hover:text-red-600" onClick={() => mutate((x) => x.courses.splice(i, 1))}>
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg border border-brand-500 px-3 py-1.5 text-sm font-semibold text-brand-700 hover:bg-brand-50"
            onClick={() =>
              mutate((x) => x.courses.push({ name: "", subjectKey: info.subjects[0].key, semester: 0, hours: r.semesterTarget }))
            }
          >
            + 과목·활동 추가
          </button>
          <button
            type="button"
            disabled={a.courses.length === 0}
            className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:bg-gray-300"
            onClick={() =>
              confirm("교과·창체 시수를 기본값으로 되돌린 뒤, 학교자율시간 학기에서 1주 분량씩 자동으로 줄일까요?") &&
              setA(autoReduce(a))
            }
          >
            교과 시수 자동 감축 (도움 기능)
          </button>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          {SEMS.map((s) => {
            const h = r.autonomyBySemester[s];
            const ok = h === 0 || h === r.semesterTarget;
            return (
              <span key={s} className={`rounded-full px-3 py-1 ${ok ? "bg-gray-100 text-gray-600" : "bg-red-100 text-red-700"}`}>
                {label(s)}: {h}시간
              </span>
            );
          })}
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-bold">② 교과·창체 편성표</h2>
        <p className="text-sm text-gray-600">
          학교 편성표와 같은 줄 구성이에요. 칸에 학기별 편성 시수를 넣으면 증감(빨강 −, 파랑 +)·계·합계가 자동 계산돼요.
          학교자율시간은 ①에서 넣으면 주황 줄로 들어가요. 증감 범위는 지침대로 교과(군) 단위로 보고, 오른쪽 끝에 이상없음/범위 밖이 표시돼요.
          내려받는 편성표(.docx)는 학교 양식 모양 그대로 나와요.
        </p>
        <AllocationFormTable a={a} setA={setA} yearOf={(s) => viewYears(grade, year)[s]} />
        <details className="text-sm">
          <summary className="cursor-pointer text-gray-600">기준시수 고치기 (학교 상황에 맞게)</summary>
          <div className="mt-2 flex flex-wrap gap-3">
            {info.subjects.map((sub) => (
              <label key={sub.key} className="flex items-center gap-1">
                {sub.key}
                <input type="number" className={cell} value={a.baseHours[sub.key]} onChange={(e) => mutate((x) => (x.baseHours[sub.key] = num(e.target.value)))} />
              </label>
            ))}
            <label className="flex items-center gap-1">
              창의적 체험활동
              <input type="number" className={cell} value={a.creativeBaseHours} onChange={(e) => mutate((x) => (x.creativeBaseHours = num(e.target.value)))} />
            </label>
          </div>
        </details>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-bold">③ 점검 결과 {errorCount > 0 && <span className={r.issues.some((i) => i.level === "error") ? "text-red-600" : "text-amber-600"}>({errorCount}건)</span>}</h2>
        <IssueList issues={r.issues} />
        <div className="flex flex-wrap gap-2">
          {(["docx", "xlsx"] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              disabled={guest}
              title={guest ? GUEST_LIMIT : kind === "xlsx" ? "엑셀에서 노란 칸을 바꾸면 합계·증감·판정이 자동으로 다시 계산돼요" : undefined}
              className="rounded-lg border-2 border-brand-600 px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:border-gray-300 disabled:text-gray-400 disabled:hover:bg-transparent"
              onClick={() => void downloadForm(kind)}
            >
              {kind === "docx" ? "📄 편성표 내려받기 (.docx)" : "📊 편성표 내려받기 (.xlsx, 수식 포함)"}
            </button>
          ))}
        </div>
        <p className={`text-xs ${guest ? "font-semibold text-red-600" : "text-gray-500"}`}>
          {guest ? "로그인해야 편성표를 내려받을 수 있어요." : "계획서·신청서의 붙임 '( )학년 교육과정 편성표'로 쓸 수 있어요."}
        </p>
      </Card>
    </div>
  );
}
