"use client";

import { Fragment, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { StatCounts, UsageStats } from "@/domain/usageStats";
import { Modal } from "../Modal";

/** 숫자 칸 (카드·표가 같은 순서·이름을 쓴다) */
const COLUMNS: { key: keyof StatCounts; label: string; short: string; hint: string }[] = [
  { key: "visit", label: "방문자", short: "방문자", hint: "하루 한 브라우저를 1명으로 셈" },
  { key: "trial", label: "체험하기", short: "체험", hint: "로그인 없이 '체험하기'를 누른 횟수" },
  { key: "signup", label: "새로 가입한 학교", short: "가입", hint: "가입 신청한 학교 수" },
  { key: "login", label: "로그인", short: "로그인", hint: "로그인 횟수 (괄호: 로그인한 학교 수)" },
  { key: "newDesigns", label: "새로 만든 설계", short: "새 설계", hint: "새 설계 + 기존 문서에서 가져온 설계" },
  { key: "download", label: "설계 문서 내려받기", short: "문서", hint: "설계 문서(.docx) 내려받기 횟수" },
  { key: "worksheet", label: "활동지 내려받기", short: "활동지", hint: "차시별 활동지 내려받기 횟수 (교사용 답안 포함)" },
  { key: "import", label: "기존 문서 가져오기", short: "가져오기", hint: "한글(hwpx) 문서에서 설계를 가져온 횟수" },
];
const WEEK = "일월화수목금토";
const dayLabel = (d: string) => `${Number(d.slice(5, 7))}. ${Number(d.slice(8, 10))}. (${WEEK[new Date(`${d}T00:00:00+09:00`).getDay()]})`;
const fmt = (n: number) => n.toLocaleString("ko-KR");

/** 관리자 '📊 이용 통계' 버튼 + 팝업: 30일 합계 카드 → 날짜별 줄 (누르면 그날 학교별 내용) */
export function UsageStatsButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-sky-500 bg-sky-50 px-3 py-1.5 text-sm font-semibold text-sky-800 hover:bg-sky-100"
      >
        📊 이용 통계
      </button>
      {open && <UsageStatsModal onClose={() => setOpen(false)} />}
    </>
  );
}

function UsageStatsModal({ onClose }: { onClose: () => void }) {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [error, setError] = useState("");
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [onlyActive, setOnlyActive] = useState(false);
  useEffect(() => {
    api<UsageStats>("/api/admin/usage")
      .then(setStats)
      .catch((e) => setError(e instanceof Error ? e.message : "불러오지 못했어요."));
  }, []);
  const active = (d: UsageStats["days"][number]) => COLUMNS.some((c) => d[c.key] > 0);
  const days = stats ? stats.days.filter((d) => !onlyActive || active(d)) : [];
  return (
    <Modal
      title="이용 통계 (최근 30일)"
      tone="brand"
      xl
      onClose={onClose}
      actions={
        <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-5 py-2 font-semibold text-gray-700 hover:bg-gray-50">
          닫기
        </button>
      }
    >
      {error && <p className="text-red-700">{error}</p>}
      {!stats && !error && <p className="text-gray-500">불러오는 중…</p>}
      {stats && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            오늘을 포함한 최근 30일(한국 시간)이에요. 관리자 계정의 활동은 빼고 셌어요.{" "}
            {stats.countingSince ? `방문자·체험하기는 ${dayLabel(stats.countingSince)}부터 세기 시작했어요.` : "방문자·체험하기는 이번 업데이트부터 세기 시작해요."}
          </p>

          {/* 맨 위: 30일 합계 + 전체 누적 */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {COLUMNS.map((c) => (
              <div key={c.key} title={c.hint} className="rounded-xl border border-brand-100 bg-white p-3">
                <p className="text-xs font-semibold text-gray-500">{c.label}</p>
                <p className="text-2xl font-bold text-brand-700">
                  {fmt(stats.last30[c.key])}
                  {c.key === "login" && <span className="ml-1 text-sm font-semibold text-gray-500">({fmt(stats.last30.loginSchools)}개 학교)</span>}
                </p>
                <p className="text-xs text-gray-500">
                  전체 누적 {fmt(stats.allTime[c.key])}
                  {c.key === "login" && ` (${fmt(stats.allTime.loginSchools)}개 학교)`}
                </p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500">
            전체 누적: 가입·새 설계는 지금까지 전부, 로그인·내려받기·가져오기는 남아 있는 이용 기록(최근 1년) 기준이에요.
          </p>

          {/* 날짜별 (누르면 그날 학교별) */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-bold">날짜별 (줄을 누르면 그날 학교별 내용이 펼쳐져요)</h3>
            <label className="flex items-center gap-1.5 text-sm text-gray-600">
              <input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} />
              기록이 있는 날만
            </label>
          </div>
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full min-w-[720px] text-center text-sm">
              <thead className="bg-brand-600 text-white">
                <tr>
                  <th className="px-2 py-2">날짜</th>
                  {COLUMNS.map((c) => (
                    <th key={c.key} title={c.hint} className="px-2 py-2 font-semibold">
                      {c.short}
                    </th>
                  ))}
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {days.length === 0 && (
                  <tr>
                    <td colSpan={COLUMNS.length + 2} className="py-4 text-gray-500">
                      기록이 있는 날이 없어요.
                    </td>
                  </tr>
                )}
                {days.map((d) => {
                  const canOpen = d.schools.length > 0;
                  const isOpen = openDay === d.day;
                  return (
                    <Fragment key={d.day}>
                      <tr
                        onClick={() => canOpen && setOpenDay(isOpen ? null : d.day)}
                        className={`${active(d) ? "" : "text-gray-300"} ${canOpen ? "cursor-pointer hover:bg-brand-50" : ""} ${isOpen ? "bg-brand-50" : ""}`}
                      >
                        <td className="px-2 py-1.5 font-semibold whitespace-nowrap">{dayLabel(d.day)}</td>
                        {COLUMNS.map((c) => (
                          <td key={c.key} className="px-2 py-1.5">
                            {d[c.key] || "·"}
                            {c.key === "login" && d.loginSchools > 0 && <span className="text-xs text-gray-500"> ({d.loginSchools})</span>}
                          </td>
                        ))}
                        <td className="text-xs text-gray-400">{canOpen ? (isOpen ? "▲" : "▼") : ""}</td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-gray-50">
                          <td colSpan={COLUMNS.length + 2} className="px-4 py-2">
                            <table className="w-full text-sm">
                              <thead className="text-xs text-gray-500">
                                <tr>
                                  <th className="py-1 text-left">학교</th>
                                  {COLUMNS.filter((c) => c.key !== "visit" && c.key !== "trial").map((c) => (
                                    <th key={c.key} className="py-1">
                                      {c.short}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {d.schools.map((s) => (
                                  <tr key={s.school} className="border-t border-gray-200">
                                    <td className="py-1 text-left font-semibold">{s.school}</td>
                                    {(["signup", "login", "newDesigns", "download", "worksheet", "import"] as const).map((k) => (
                                      <td key={k} className="py-1">
                                        {s[k] || "·"}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            <p className="mt-1 text-xs text-gray-500">방문자·체험하기는 누가 했는지 남기지 않아 학교별로는 보이지 않아요.</p>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                <tr>
                  <td className="px-2 py-2">30일 합계</td>
                  {COLUMNS.map((c) => (
                    <td key={c.key} className="px-2 py-2">
                      {fmt(stats.last30[c.key])}
                    </td>
                  ))}
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}
