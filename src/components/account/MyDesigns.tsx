"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { DesignDoc } from "@/domain/types";
import { api } from "@/lib/api";
import { stepsFor } from "../wizard/Wizard";
import { semesterHours } from "@/validation/hours";
import { bandStatus, checkKey, isViewGrade, schoolYearOf, type Checks, type HourCheck } from "@/domain/hoursView";
import type { Grade } from "@/domain/types";
import { Card } from "../ui";
import { useMe } from "../useMe";

export interface DesignRow {
  id: string;
  name: string;
  type: "subject" | "activity";
  grade: number;
  semester: number;
  hours?: number;
  schoolYear?: string;
  subjectGroup?: string;
  schoolName: string;
  errorCount: number;
  warningCount: number;
  progress?: { stepKey: string; maxIndex: number } | null;
  createdAt?: string;
  updatedAt: string;
  owner?: string;
}

export const fmtDate = (s: string | null | undefined) => (s ? new Date(s).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" }) : "-");

/** 상태 표시: 완성 / 작성 중(지금 단계) / 최종 점검에서 오류 수 */
export function StatusBadge({ errors, warnings, type, progress }: { errors: number; warnings: number; type?: DesignRow["type"]; progress?: DesignRow["progress"] }) {
  if (errors > 0 && type && progress && progress.stepKey !== "final") {
    const steps = stepsFor({ basic: { type } });
    const i = steps.findIndex((s) => s.key === progress.stepKey);
    if (i >= 0) {
      return (
        <span className="shrink-0 rounded-full bg-blue-100 px-2.5 py-1 text-sm font-semibold text-blue-700">
          작성 중 · {i + 1}/{steps.length} {steps[i].label}
        </span>
      );
    }
  }
  return errors === 0 ? (
    <span className="shrink-0 rounded-full bg-green-100 px-2.5 py-1 text-sm font-semibold text-green-700">완성{warnings ? ` · 확인 ${warnings}` : ""}</span>
  ) : (
    <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-sm font-semibold text-amber-700">점검 필요 · 오류 {errors}</span>
  );
}

export function MyDesigns() {
  const me = useMe();
  const router = useRouter();
  const [rows, setRows] = useState<DesignRow[] | null>(null);
  const [checks, setChecks] = useState<Checks>({});
  const [error, setError] = useState("");
  const [gradeFilter, setGradeFilter] = useState<number | null>(null);
  const [yearFilter, setYearFilter] = useState("");
  const load = useCallback(() => {
    api<{ designs: DesignRow[] }>("/api/designs")
      .then((r) => setRows(r.designs))
      .catch((e) => setError(e.message));
    api<{ checks: { grade: number; data: HourCheck }[] }>("/api/hours")
      .then((r) => {
        const map: Checks = {};
        for (const c of r.checks) if (isViewGrade(c.grade) && c.data?.schoolYear) map[checkKey(c.data.schoolYear, c.grade)] = c.data;
        setChecks(map);
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (me?.user) load();
  }, [me, load]);

  const duplicate = async (row: DesignRow) => {
    const from = Number(row.schoolYear) || schoolYearOf(new Date());
    const answer = prompt(`「${row.name}」을(를) 몇 학년도 설계로 복제할까요?\n(복제한 뒤 내용을 고쳐 쓰면 돼요)`, String(from + 1));
    if (answer === null) return;
    const year = Number(answer.trim());
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      alert("학년도는 2028처럼 네 자리 숫자로 적어 주세요.");
      return;
    }
    const { design } = await api<{ design: { doc: DesignDoc } }>(`/api/designs/${row.id}`);
    const doc = structuredClone(design.doc);
    doc.application.startYear = String(year);
    if (year === from) doc.basic.name = `${doc.basic.name} (복사본)`.slice(0, 40);
    await api("/api/designs", { method: "POST", body: { doc } }).catch((e) => alert(e.message));
    setYearFilter("");
    load();
  };
  const remove = async (row: DesignRow) => {
    if (!confirm(`「${row.name}」 설계를 삭제할까요? 되돌릴 수 없어요.`)) return;
    await api(`/api/designs/${row.id}`, { method: "DELETE" }).catch((e) => alert(e.message));
    load();
  };

  if (me && !me.user) {
    return (
      <Card className="space-y-2">
        <h1 className="text-xl font-bold">설계 현황</h1>
        <p className="text-gray-600">{me.enabled ? "로그인하면 저장한 설계를 볼 수 있어요." : "저장 기능이 아직 설정되지 않았습니다."}</p>
        {me.enabled && <Link href="/login" className="font-semibold text-brand-600 underline">로그인</Link>}
      </Card>
    );
  }
  const years = [...new Set((rows ?? []).map(yearOf))].sort((a, b) => b.localeCompare(a));
  const shown = (rows ?? [])
    .filter((r) => (gradeFilter === null || r.grade === gradeFilter) && (!yearFilter || yearOf(r) === yearFilter))
    .sort((a, b) => (b.createdAt ?? b.updatedAt).localeCompare(a.createdAt ?? a.updatedAt));
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">설계 현황</h1>
        <Link href="/designs/new" className="rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white hover:bg-brand-700">+ 새 설계</Link>
      </div>
      {error && <p className="text-red-700">{error}</p>}
      {rows === null ? (
        <p className="text-gray-500">불러오는 중…</p>
      ) : rows.length === 0 ? (
        <Card><p className="text-gray-600">아직 저장한 설계가 없어요. 새 설계를 시작해 보세요.</p></Card>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white p-3 shadow-sm">
            {[null, 3, 4, 5, 6].map((g) => (
              <button
                key={g ?? "all"}
                type="button"
                onClick={() => setGradeFilter(g)}
                className={`rounded-lg px-4 py-2 font-semibold transition ${gradeFilter === g ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
              >
                {g === null ? "전체" : `${g}학년`}
              </button>
            ))}
            <label className="ml-auto flex items-center gap-2 text-sm font-semibold text-gray-700">
              학년도
              <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-base">
                <option value="">전체</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}학년도
                  </option>
                ))}
              </select>
            </label>
          </div>
          {shown.length === 0 ? (
            <Card><p className="text-gray-600">조건에 맞는 설계가 없어요.</p></Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {shown.map((r) => (
                <div
                  key={r.id}
                  role="link"
                  tabIndex={0}
                  onClick={() => router.push(`/designs/${r.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") router.push(`/designs/${r.id}`);
                  }}
                  className="flex cursor-pointer flex-col gap-3 rounded-2xl border-2 border-transparent bg-white p-4 shadow-sm transition hover:border-brand-500 hover:shadow-md focus:border-brand-500 focus:outline-none"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap gap-1.5">
                      <StatusBadge errors={r.errorCount} warnings={r.warningCount} type={r.type} progress={r.progress} />
                      <SemesterBadge row={r} rows={rows} />
                    </div>
                    <p className="text-sm text-gray-500">
                      <b className="text-gray-700">{yearOf(r)}학년도</b> · {r.type === "subject" ? "과목" : "활동"} · {r.grade}학년 {r.semester}학기
                      {typeof r.hours === "number" ? ` · ${r.hours}차시` : ""}
                    </p>
                    <p className="text-lg font-bold leading-snug">{r.name || "(이름 없음)"}</p>
                  </div>
                  <p className="mt-auto text-xs text-gray-400">마지막 저장 {fmtDate(r.updatedAt)}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {bandStatus(r.grade, Number(yearOf(r)), checks, rows).complete ? (
                      <span className="rounded-lg border border-green-200 bg-green-50 px-2.5 py-1.5 text-sm font-semibold text-green-700">✓ 시수점검 완료</span>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/hours?grade=${r.grade}&year=${yearOf(r)}`);
                        }}
                        className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-100"
                      >
                        ⚠ 시수점검
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void duplicate(r);
                      }}
                      className="rounded-lg border border-brand-100 bg-brand-50 px-2.5 py-1.5 text-sm font-semibold text-brand-700 hover:bg-brand-100"
                    >
                      복제
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void remove(r);
                      }}
                      className="rounded-lg border border-red-100 bg-red-50 px-2.5 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-100"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const yearOf = (r: DesignRow) => r.schoolYear || "2027";

/**
 * 그 학년도·학년·학기에 만든 설계 차시 합계 (같은 학기의 다른 설계 포함).
 * 예: 10 + 19 = 29 / 29차시 → 모두 편성 · 부족 · 초과 · 10차시 미만 남음
 */
export function semesterFill(row: DesignRow, rows: DesignRow[]) {
  const same = rows.filter((x) => yearOf(x) === yearOf(row) && x.grade === row.grade && x.semester === row.semester);
  const max = semesterHours(row.grade as Grade);
  const sum = same.reduce((t, x) => t + (x.hours ?? 0), 0);
  return { max, sum, left: max - sum, count: same.length };
}

function SemesterBadge({ row, rows }: { row: DesignRow; rows: DesignRow[] }) {
  const { max, sum, left, count } = semesterFill(row, rows);
  const detail = `${row.grade}학년 ${row.semester}학기 설계 ${count}개 합계 ${sum} / ${max}차시`;
  const [cls, text] =
    left === 0
      ? ["bg-green-100 text-green-700", `✓ ${sum}/${max}차시 편성`]
      : left < 0
        ? ["bg-red-100 text-red-700", `${-left}차시 초과`]
        : left < 10
          ? ["bg-red-100 text-red-700", `${left}차시 남음 — 기존 설계 조정 필요`]
          : ["bg-red-100 text-red-700", `${left}차시 추가 편성 필요`];
  return (
    <span title={detail} className={`rounded-full px-2.5 py-1 text-sm font-semibold ${cls}`}>
      {text}
    </span>
  );
}
