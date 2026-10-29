"use client";

import { useEffect, useState } from "react";
import {
  bandInfo,
  checkAllocation,
  defaultAllocation,
  oneWeekHours,
  semesterLabel,
  type AllocationInput,
  type BandKey,
  type FourSemesters,
  type SemesterIndex,
} from "@/validation/allocation";
import { Packer } from "docx";
import { buildAllocationDocx } from "@/export/allocationDocx";
import { Card, IssueList } from "../ui";

const STORE_KEY = "sat-hours-v1";
const SEMS: SemesterIndex[] = [0, 1, 2, 3];
const num = (v: string) => Math.max(0, Math.floor(Number(v) || 0));
const cell = "w-16 rounded border border-gray-300 px-1 py-1 text-right text-sm focus:border-brand-500 focus:outline-none";
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** 학교자율시간을 운영하는 학기에서 교과·창체를 '1주 수업시간'만큼 줄여 주는 도움 기능 */
function autoReduce(a: AllocationInput): AllocationInput {
  const base = defaultAllocation(a.band);
  const next: AllocationInput = { ...a, subjectHours: base.subjectHours, creativeHours: base.creativeHours };
  const subjects = bandInfo(a.band).subjects;
  for (const s of SEMS) {
    const need = a.courses.filter((c) => c.semester === s).reduce((t, c) => t + c.hours, 0);
    if (need === 0) continue;
    let cut = 0;
    for (const sub of subjects) {
      if (sub.noReduction) continue; // 체육·음악·미술은 감축 불가
      const w = Math.floor(oneWeekHours(a.baseHours[sub.key] ?? sub.baseHours));
      next.subjectHours[sub.key][s] -= w;
      cut += w;
    }
    const cw = Math.floor(oneWeekHours(a.creativeBaseHours));
    next.creativeHours[s] -= cw;
    cut += cw;
    // 모자라는 시수는 국어 → 수학 순서로 추가 감축 (넘치면 되돌림)
    const order = ["국어", "수학", "영어", "사회"];
    let k = 0;
    while (cut !== need && k < 500) {
      const key = order[k % order.length];
      if (next.subjectHours[key]) next.subjectHours[key][s] += cut > need ? 1 : -1;
      cut += cut > need ? -1 : 1;
      k++;
    }
  }
  return next;
}

export function HoursChecker() {
  const [a, setA] = useState<AllocationInput>(() => defaultAllocation("3-4"));
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) setA(JSON.parse(raw));
    } catch {
      /* 무시하고 기본값 사용 */
    }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(a));
    } catch {
      /* 저장 못 해도 동작에는 지장 없음 */
    }
  }, [a, loaded]);

  const info = bandInfo(a.band);
  const r = checkAllocation(a);
  const mutate = (fn: (x: AllocationInput) => void) => {
    const next = structuredClone(a);
    fn(next);
    setA(next);
  };
  const switchBand = (band: BandKey) => {
    if (band === a.band) return;
    if (a.courses.length && !confirm("학년군을 바꾸면 입력한 내용이 초기화됩니다. 바꿀까요?")) return;
    setA(defaultAllocation(band));
  };
  const errorCount = r.issues.length;

  return (
    <div className="space-y-5">
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-bold">학교자율시간 시수 편성 점검</h1>
          <div className="flex gap-1 rounded-lg bg-gray-100 p-1 text-sm">
            {(["3-4", "5-6"] as BandKey[]).map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => switchBand(b)}
                className={`rounded-md px-3 py-1 ${a.band === b ? "bg-white font-semibold text-brand-700 shadow-sm" : "text-gray-500"}`}
              >
                {bandInfo(b).label}
              </button>
            ))}
          </div>
        </div>
        <ol className="list-decimal space-y-0.5 pl-5 text-sm text-gray-600">
          <li>해당 학년군의 기준시수를 확인합니다. (학교 상황에 맞게 고칠 수 있어요)</li>
          <li>학교자율시간 과목(활동)을 관련 교과에 기록하고 운영 시수를 입력합니다.</li>
          <li>교과별 &lsquo;1주 수업시간&rsquo;을 참고하여 교과·창체 시수를 편성합니다.</li>
          <li>&lsquo;이상유무&rsquo;가 모두 &lsquo;이상없음&rsquo;인지 확인합니다.</li>
        </ol>
        <p className="text-xs text-gray-400">기준: 학교자율시간 시수 편성 점검표(엑셀) 계산식</p>
      </Card>

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
                    <input
                      className="w-full rounded border border-gray-300 px-2 py-1"
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
                        <option key={s} value={s}>{semesterLabel(a.band, s)}</option>
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
                {semesterLabel(a.band, s)}: {h}시간
              </span>
            );
          })}
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-bold">② 교과·창체 편성표</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="bg-brand-50 text-xs text-gray-600">
              <tr>
                <th className="p-2 text-left">교과(군)</th>
                <th className="p-2 text-left">교과</th>
                <th className="p-2">기준시수</th>
                {SEMS.map((s) => (
                  <th key={s} className="p-2">{semesterLabel(a.band, s)}</th>
                ))}
                <th className="p-2">학교자율시간</th>
                <th className="p-2">편성시수</th>
                <th className="p-2">1주 수업시간</th>
                <th className="p-2">증감범위</th>
                <th className="p-2">이상유무</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {info.subjects.map((s, i) => {
                const row = r.rows[i];
                return (
                  <tr key={s.key}>
                    <td className="p-2 text-gray-500">{s.group}</td>
                    <td className="p-2 font-medium">
                      {s.key}
                      {s.noReduction && <span className="ml-1 text-xs text-blue-600">(감축 불가)</span>}
                    </td>
                    <td className="p-2 text-center">
                      <input
                        type="number"
                        className={cell}
                        value={a.baseHours[s.key]}
                        onChange={(e) => mutate((x) => (x.baseHours[s.key] = num(e.target.value)))}
                      />
                    </td>
                    {SEMS.map((sem) => (
                      <td key={sem} className="p-2 text-center">
                        <input
                          type="number"
                          className={cell}
                          value={a.subjectHours[s.key][sem]}
                          onChange={(e) => mutate((x) => ((x.subjectHours[s.key] as FourSemesters)[sem] = num(e.target.value)))}
                        />
                      </td>
                    ))}
                    <td className="p-2 text-center">{row.autonomy || "-"}</td>
                    <td className="p-2 text-center font-semibold">{row.planned}</td>
                    <td className="p-2 text-center">{fmt(row.oneWeek)}</td>
                    <td className="p-2 text-center text-gray-500">{row.min}~{row.max}</td>
                    <td className="p-2 text-center"><Status ok={row.ok} /></td>
                  </tr>
                );
              })}
              <tr className="bg-gray-50 font-semibold">
                <td className="p-2" colSpan={2}>교과 소계</td>
                <td className="p-2 text-center">{r.subtotal.baseHours}</td>
                <td colSpan={4} />
                <td className="p-2 text-center">{r.subtotal.autonomy || "-"}</td>
                <td className="p-2 text-center">{r.subtotal.planned}</td>
                <td className="p-2 text-center">{fmt(r.subtotal.oneWeek)}</td>
                <td className="p-2 text-center text-gray-500">{r.subtotal.min}~{r.subtotal.max}</td>
                <td className="p-2 text-center"><Status ok={r.subtotal.ok} /></td>
              </tr>
              <tr>
                <td className="p-2 font-medium" colSpan={2}>창의적 체험활동</td>
                <td className="p-2 text-center">
                  <input
                    type="number"
                    className={cell}
                    value={a.creativeBaseHours}
                    onChange={(e) => mutate((x) => (x.creativeBaseHours = num(e.target.value)))}
                  />
                </td>
                {SEMS.map((sem) => (
                  <td key={sem} className="p-2 text-center">
                    <input
                      type="number"
                      className={cell}
                      value={a.creativeHours[sem]}
                      onChange={(e) => mutate((x) => (x.creativeHours[sem] = num(e.target.value)))}
                    />
                  </td>
                ))}
                <td className="p-2 text-center">-</td>
                <td className="p-2 text-center font-semibold">{r.creative.planned}</td>
                <td className="p-2 text-center">{fmt(r.creative.oneWeek)}</td>
                <td className="p-2 text-center text-gray-500">{r.creative.min}~{r.creative.max}</td>
                <td className="p-2 text-center"><Status ok={r.creative.ok} /></td>
              </tr>
              <tr className="bg-brand-50 font-bold">
                <td className="p-2" colSpan={2}>학년군 총 수업 시간 수</td>
                <td className="p-2 text-center">{r.total.baseHours}</td>
                <td colSpan={5} />
                <td className="p-2 text-center">{r.total.planned}</td>
                <td colSpan={2} className="p-2 text-center text-xs font-normal text-gray-500">기준과 같아야 함</td>
                <td className="p-2 text-center"><Status ok={r.total.ok} /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-bold">③ 점검 결과 {errorCount > 0 && <span className="text-red-600">({errorCount}건)</span>}</h2>
        <IssueList issues={r.issues} />
        <button
          type="button"
          className="rounded-lg border-2 border-brand-600 px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50"
          onClick={async () => {
            const url = URL.createObjectURL(await Packer.toBlob(buildAllocationDocx(a)));
            const link = document.createElement("a");
            link.href = url;
            link.download = `${info.label}_교육과정_편성표.docx`;
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

function Status({ ok }: { ok: boolean }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${ok ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
      {ok ? "이상없음" : "점검필요"}
    </span>
  );
}
