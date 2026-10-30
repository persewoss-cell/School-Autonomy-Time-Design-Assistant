"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  VIEW_GRADES,
  bandStatus,
  checkOk,
  designDiff,
  initialCheck,
  isViewGrade,
  pairGrade,
  schoolYearOf,
  semesterLabelWithYear,
  syncWithDesigns,
  viewYears,
  type HourCheck,
  type ViewGrade,
} from "@/domain/hoursView";
import { useHourChecks } from "./useHourChecks";
import { AllocationFormTable } from "./AllocationFormTable";
import {
  bandInfo,
  autoReduce,
  checkAllocation,
  type AllocationInput,
  type SemesterIndex,
} from "@/validation/allocation";
import { Packer } from "docx";
import { buildAllocationDocx } from "@/export/allocationDocx";
import { Card, IssueList } from "../ui";

const SEMS: SemesterIndex[] = [0, 1, 2, 3];
const num = (v: string) => Math.max(0, Math.floor(Number(v) || 0));
const cell = "w-16 rounded border border-gray-300 px-1 py-1 text-right text-sm focus:border-brand-500 focus:outline-none";

export function HoursChecker() {
  const params = useSearchParams();
  const router = useRouter();
  const q = Number(params.get("grade"));
  const grade: ViewGrade = isViewGrade(q) ? q : 3;
  const { checks, designs, loaded, save, loggedIn, me } = useHourChecks();
  const [check, setCheck] = useState<HourCheck | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // 학년 화면을 열 때: 저장본이 있으면 그것, 없으면 설계 현황을 넣은 기본값
  useEffect(() => {
    if (!loaded) return;
    setCheck(checks[grade] ?? initialCheck(grade, schoolYearOf(new Date()), designs));
    setDirty(false);
    setSaveState(checks[grade] ? "saved" : "idle");
    // checks는 저장할 때마다 바뀌므로 학년을 바꿀 때만 다시 불러온다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grade, loaded, designs]);

  // 아직 저장 안 된 고침: 학년을 바꾸거나 페이지를 떠날 때 바로 저장한다
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
  const switchGrade = async (g: ViewGrade) => {
    if (pending.current) {
      setSaveState("saving");
      await save(pending.current).catch(() => setSaveState("error"));
      pending.current = null;
    }
    router.replace(`/hours?grade=${g}`);
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
  const info = bandInfo(a.band);
  const r = checkAllocation(a);
  const mutate = (fn: (x: AllocationInput) => void) => {
    const next = structuredClone(a);
    fn(next);
    setA(next);
  };
  const label = (s: SemesterIndex) => semesterLabelWithYear(grade, check.schoolYear, s);
  const errorCount = r.issues.length;
  const diff = designDiff(check, designs);
  const all = { ...checks, [grade]: check };
  const status = bandStatus(grade, all, designs);
  const thisOk = checkOk(check, designs);
  const pair = pairGrade(grade);

  return (
    <div className="space-y-5">
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-bold">학교자율시간 시수 편성 점검</h1>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            올해 학년도
            <input
              type="number"
              className="w-24 rounded border border-gray-300 px-2 py-1"
              value={check.schoolYear}
              onChange={(e) => {
                setCheck({ ...check, schoolYear: Number(e.target.value) || check.schoolYear });
                setDirty(true);
              }}
            />
          </label>
        </div>
        <ol className="list-decimal space-y-0.5 pl-5 text-sm text-gray-600">
          <li>아래에서 학년을 고릅니다. 예: &lsquo;3학년&rsquo; = 지금 3학년 학생들의 3학년(올해)·4학년(내년) 시수</li>
          <li>설계 현황의 학교자율시간이 자동으로 들어가요. 바꿀 계획이 있으면 추가·삭제·수정하세요.</li>
          <li>교과별 &lsquo;1주 수업시간&rsquo;을 참고하여 교과·창체 시수를 편성합니다. (기준시수도 학교 상황에 맞게 고칠 수 있어요)</li>
          <li>&lsquo;이상유무&rsquo;가 모두 &lsquo;이상없음&rsquo;인지 확인합니다. 학년군의 두 학년이 모두 이상없음이면 시수 점검 완료!</li>
        </ol>
        <p className="text-xs text-gray-400">
          기준: 학교자율시간 시수 편성 점검표(엑셀) 계산식 · {loggedIn ? "학교 계정에 자동 저장" : "로그인하지 않아 이 브라우저에만 저장"}
          {saveState === "saving" ? " · 저장 중…" : saveState === "saved" ? " · ✓ 저장됨" : saveState === "error" ? " · ⚠ 저장 실패" : " · 아직 저장 안 됨"}
        </p>
      </Card>

      {/* 학년 버튼: 좌우로 꽉 차는 네모 버튼 4개 */}
      <div className="grid grid-cols-4 gap-2">
        {VIEW_GRADES.map((g) => {
          const ok = checkOk(all[g], designs);
          const on = g === grade;
          return (
            <button
              key={g}
              type="button"
              onClick={() => void switchGrade(g)}
              className={`rounded-lg border-2 py-3 text-center font-bold transition ${
                on ? "border-brand-600 bg-brand-600 text-white" : "border-gray-200 bg-white text-gray-700 hover:border-brand-500"
              }`}
            >
              {g}학년
              <span className={`block text-xs font-semibold ${on ? "text-white/90" : ok ? "text-green-700" : all[g] ? "text-red-600" : "text-gray-400"}`}>
                {ok ? "✓ 이상없음" : all[g] ? "점검 필요" : "아직 안 함"}
              </span>
            </button>
          );
        })}
      </div>

      <div
        className={`rounded-xl p-4 text-sm ${status.complete ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-900"}`}
      >
        <p className="font-semibold">
          {status.complete
            ? `✓ ${info.label} 시수 점검 완료 — 설계 현황에 '시수점검 완료'로 표시돼요.`
            : `${info.label} 시수 점검: ${grade}학년 화면 ${thisOk ? "이상없음" : "점검 필요"} · ${pair}학년 화면 ${checkOk(all[pair], designs) ? "이상없음" : all[pair] ? "점검 필요" : "아직 안 함"}`}
        </p>
        {!status.complete && <p className="mt-1">학년군의 두 학년 화면({info.grades.join("·")}학년)이 모두 이상없음이어야 시수 점검 완료예요.</p>}
        {status.gradesWithoutDesign.length > 0 && (
          <p className="mt-1">
            {status.gradesWithoutDesign.join("·")}학년은 설계 현황에 설계가 없어 자동으로 들어가지 않아요. 아래 &lsquo;+ 과목·활동 추가&rsquo;로 직접 입력해 주세요.
          </p>
        )}
      </div>

      {diff.length > 0 && (
        <div className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">설계 현황과 다른 점이 있어요. 반영해야 이상없음이 돼요.</p>
          <ul className="list-disc pl-5">
            {diff.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
          <button
            type="button"
            className="rounded-lg bg-red-600 px-3 py-1.5 font-semibold text-white hover:bg-red-700"
            onClick={() => {
              setCheck(syncWithDesigns(check, designs));
              setDirty(true);
            }}
          >
            설계 현황 반영하기 (직접 추가한 것은 그대로)
          </button>
        </div>
      )}

      <Card className="space-y-3">
        <h2 className="font-bold">① 학교자율시간 과목·활동</h2>
        <p className="text-sm text-gray-600">
          운영하는 학기는 합계가 <b>{r.semesterTarget}시간</b>(1주 분량)이어야 하고, 학년마다 한 학기 이상 운영합니다.
          한 과목·활동은 10시간 이상, 학기당 3개 이내.
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
        <AllocationFormTable a={a} setA={setA} yearOf={(s) => viewYears(grade, check.schoolYear)[s]} />
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
        <h2 className="font-bold">③ 점검 결과 {errorCount > 0 && <span className="text-red-600">({errorCount}건)</span>}</h2>
        <IssueList issues={r.issues} />
        <button
          type="button"
          className="rounded-lg border-2 border-brand-600 px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50"
          onClick={async () => {
            const url = URL.createObjectURL(await Packer.toBlob(buildAllocationDocx(a, { years: viewYears(grade, check.schoolYear), grade, schoolYear: check.schoolYear, schoolName: me?.user?.schoolName })));
            const link = document.createElement("a");
            link.href = url;
            link.download = `${grade}학년_교육과정_편성표.docx`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}
        >
          📄 편성표 내려받기 (.docx)
        </button>
        <p className="text-xs text-gray-500">계획서·신청서의 붙임 &lsquo;( )학년 교육과정 편성표&rsquo;로 쓸 수 있어요.</p>
      </Card>
    </div>
  );
}
