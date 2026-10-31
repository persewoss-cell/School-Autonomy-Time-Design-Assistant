"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { DesignDoc } from "@/domain/types";
import { api, sendLog } from "@/lib/api";
import { checklistResults, validateDesign } from "@/validation/design";
import type { Issue } from "@/validation/types";
import { allocationFor, FORM_NOTICE, saveDesignDocx } from "../wizard/downloadDesign";
import { Modal } from "../Modal";
import { DownloadIcon } from "../icons";
import { stepsFor } from "../wizard/Wizard";
import { sameSemesterOthers, semesterHours } from "@/validation/hours";
import { bandStatus, checkKey, isViewGrade, schoolYearOf, type Checks, type HourCheck } from "@/domain/hoursView";
import type { Grade } from "@/domain/types";
import { Card, TypeTag } from "../ui";
import { MultiSelect, SingleSelect } from "../admin/MultiSelect";
import { byYearThenSaved, NARROW, SortTh, useSort } from "../admin/sort";
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
  checklistLeft?: number;
  progress?: { stepKey: string; maxIndex: number } | null;
  createdAt?: string;
  updatedAt: string;
  owner?: string;
}

/** 표용 짧은 날짜: 10. 31. 오전 9:18 */
const shortDate = (s: string) => new Date(s).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" });

const TYPE_OPTIONS = [
  { value: "activity", label: "활동" },
  { value: "subject", label: "과목" },
];
const STATUS_OPTIONS = [
  { value: "complete", label: "완성" },
  { value: "progress", label: "설계 중" },
];

export const fmtDate = (s: string | null | undefined) => (s ? new Date(s).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" }) : "-");

/** 상태 표시: 완성 / 작성 중(지금 단계) / 최종 점검에서 오류 수 */
export function StatusBadge({
  errors,
  warnings,
  type,
  progress,
  compact,
}: {
  errors: number;
  warnings: number;
  type?: DesignRow["type"];
  progress?: DesignRow["progress"];
  /** 설계 현황 카드: 작게, 단계 이름 없이 */
  compact?: boolean;
}) {
  const size = compact ? "px-2 py-0.5 text-xs whitespace-nowrap" : "px-2.5 py-1 text-sm";
  if (errors > 0 && type && progress && progress.stepKey !== "final") {
    const steps = stepsFor({ basic: { type } });
    const i = steps.findIndex((s) => s.key === progress.stepKey);
    if (i >= 0) {
      return (
        <span className={`shrink-0 rounded-full bg-blue-100 font-semibold text-blue-700 ${size}`}>
          작성 중 · {i + 1}/{steps.length}
          {compact ? "" : ` ${steps[i].label}`}
        </span>
      );
    }
  }
  return errors === 0 ? (
    <span className={`shrink-0 rounded-full bg-green-100 font-semibold text-green-700 ${size}`}>완성{warnings ? ` · 확인 ${warnings}` : ""}</span>
  ) : (
    <span className={`shrink-0 rounded-full bg-amber-100 font-semibold text-amber-700 ${size}`}>{compact ? "" : "점검 필요 · "}오류 {errors}</span>
  );
}

export function MyDesigns() {
  const me = useMe();
  const router = useRouter();
  const [rows, setRows] = useState<DesignRow[] | null>(null);
  const [checks, setChecks] = useState<Checks>({});
  const [error, setError] = useState("");
  const [years, setYears] = useState<string[]>([]);
  const [type, setType] = useState("");
  const [grades, setGrades] = useState<string[]>([]);
  const [status, setStatus] = useState("");
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
    const saved = await api("/api/designs", { method: "POST", body: { doc } }).then(
      () => true,
      (e) => (alert(e.message), false),
    );
    setYears([]);
    load();
    // 같은 학년도로 복제해서 그 학기 시수가 넘치면 알려 준다 (복제는 허용)
    if (saved && rows && year === from) {
      const { max, sum } = semesterFill(row, rows);
      const over = sum + (row.hours ?? 0) - max;
      if (over > 0) {
        alert(
          `${year}학년도 ${row.grade}학년 ${row.semester}학기가 ${over}차시 넘쳐요. (${sum + (row.hours ?? 0)} / ${max}차시)\n복제한 「${doc.basic.name}」의 학년·학기·차시를 기본 정보에서 바꿔 주세요.`,
        );
      }
    }
  };
  // 카드에서 바로 문서 내려받기 (최종 점검 화면과 같은 안내·같은 문서)
  const [busyId, setBusyId] = useState<string | null>(null);
  const download = async (row: DesignRow) => {
    if (!confirm(`${FORM_NOTICE}\n\n확인을 누르면 내려받습니다.`)) return;
    setBusyId(row.id);
    try {
      const { design } = await api<{ design: { doc: DesignDoc } }>(`/api/designs/${row.id}`);
      const left = checklistResults(design.doc).filter((c) => !c.ok).length;
      if (left > 0) {
        alert(`체크리스트에 확인하지 않은 항목이 ${left}개 있어요. 설계의 '점검·내려받기' 단계에서 확인해 주세요.`);
        return;
      }
      await saveDesignDocx(design.doc, allocationFor(design.doc, row.id, checks, rows ?? []).attachment);
      sendLog("download", undefined, row.id);
    } catch (e) {
      alert(e instanceof Error ? e.message : "문서를 만들지 못했어요.");
    } finally {
      setBusyId(null);
    }
  };
  // '확인 N' 버튼: 이 화면에서 확인 사항(경고) 목록 팝업
  const [warnView, setWarnView] = useState<{ row: DesignRow; issues: Issue[] } | null>(null);
  const showWarnings = async (row: DesignRow) => {
    const { design } = await api<{ design: { doc: DesignDoc } }>(`/api/designs/${row.id}`);
    const semesterOthers = sameSemesterOthers({ id: row.id, grade: row.grade, semester: row.semester, schoolYear: row.schoolYear }, rows ?? []);
    setWarnView({ row, issues: validateDesign(design.doc, { semesterOthers }).filter((i) => i.level === "warning") });
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
  const all = rows ?? [];
  const yearOptions = [...new Set(all.map(yearOf))].sort((a, b) => b.localeCompare(a)).map((v) => ({ value: v, label: `${v}학년도` }));
  const shown = all.filter(
    (r) =>
      (years.length === 0 || years.includes(yearOf(r))) &&
      (!type || r.type === type) &&
      (grades.length === 0 || grades.includes(String(r.grade))) &&
      (!status || (status === "complete" ? r.errorCount === 0 : r.errorCount > 0)),
  );
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">설계 현황</h1>
        <span className="flex gap-2">
          <Link href="/designs/new" className="rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white hover:bg-brand-700">+ 새 설계</Link>
          {/* 타학교 완성 설계안에서 복제해 가져오기 */}
          <Link href="/shared" className="rounded-lg bg-sky-600 px-4 py-2 font-semibold text-white hover:bg-sky-700">가져오기</Link>
        </span>
      </div>
      {error && <p className="text-red-700">{error}</p>}
      {rows === null ? (
        <p className="text-gray-500">불러오는 중…</p>
      ) : rows.length === 0 ? (
        <Card><p className="text-gray-600">아직 저장한 설계가 없어요. 새 설계를 시작해 보세요.</p></Card>
      ) : (
        <div className="space-y-3">
          {/* 관리자 '전체 설계'와 같은 모양 (학교·검색 빼고) */}
          <div className="flex flex-wrap items-center gap-2">
            <MultiSelect allLabel="전체 학년도" options={yearOptions} selected={years} onChange={setYears} />
            <SingleSelect allLabel="전체 유형" options={TYPE_OPTIONS} value={type} onChange={setType} />
            <MultiSelect allLabel="전체 학년" options={[3, 4, 5, 6].map((g) => ({ value: String(g), label: `${g}학년` }))} selected={grades} onChange={setGrades} />
            <SingleSelect allLabel="전체 상태" options={STATUS_OPTIONS} value={status} onChange={setStatus} />
            <span className="text-sm text-gray-500">{shown.length}건</span>
          </div>
          <DesignTable
            rows={shown}
            all={rows}
            checks={checks}
            busyId={busyId}
            onOpen={(r) => router.push(`/designs/${r.id}`)}
            onHours={(r) => router.push(`/hours?grade=${r.grade}&year=${yearOf(r)}`)}
            onDownload={(r) => void download(r)}
            onWarnings={(r) => void showWarnings(r)}
            onDuplicate={(r) => void duplicate(r)}
            onRemove={(r) => void remove(r)}
          />
        </div>
      )}
      {warnView && (
        <Modal
          tone="amber"
          title={`확인할 사항 ${warnView.issues.length}개`}
          onClose={() => setWarnView(null)}
          actions={
            <>
              <button type="button" onClick={() => setWarnView(null)} className="rounded-lg border border-gray-300 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50">
                닫기
              </button>
              <button type="button" onClick={() => router.push(`/designs/${warnView.row.id}`)} className="rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white hover:bg-brand-700">
                설계 열어 고치기
              </button>
            </>
          }
        >
          <p className="font-semibold">「{warnView.row.name}」</p>
          <p className="text-sm text-gray-600">오류는 아니지만 지침에 맞는지 한 번 더 확인해 보세요.</p>
          <ul className="max-h-80 space-y-2 overflow-y-auto">
            {warnView.issues.map((i, k) => (
              <li key={k} className="rounded-lg border-l-4 border-orange-400 bg-orange-50 p-2 text-sm">
                <p className="font-semibold text-orange-800">{i.field}</p>
                <p>{i.message}</p>
                {i.fix && <p className="text-gray-600">→ {i.fix}</p>}
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </div>
  );
}

/** 문서를 내려받을 수 있는지: 오류 0개, 체크리스트 모두 ○ (예전 저장본은 누를 때 확인) */
const docReady = (r: DesignRow) => r.errorCount === 0 && (r.checklistLeft ?? 0) === 0;

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
    <span title={detail} className={`rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${cls}`}>
      {text}
    </span>
  );
}

const yearOrder = (r: DesignRow) => ({ schoolYear: yearOf(r), updatedAt: r.updatedAt });

/**
 * 설계 현황 표: 관리자 '전체 설계'와 같은 열 순서 (학교 열 없음) + 학교 화면에만 있는 칸(차시·학기 편성·문서·복제).
 * 기본 순서는 학년도 내림차순 → 마지막 저장 내림차순, 제목 세모로 정렬.
 */
function DesignTable({
  rows,
  all,
  checks,
  busyId,
  onOpen,
  onHours,
  onDownload,
  onWarnings,
  onDuplicate,
  onRemove,
}: {
  rows: DesignRow[];
  all: DesignRow[];
  checks: Checks;
  busyId: string | null;
  onOpen: (r: DesignRow) => void;
  onHours: (r: DesignRow) => void;
  onDownload: (r: DesignRow) => void;
  onWarnings: (r: DesignRow) => void;
  onDuplicate: (r: DesignRow) => void;
  onRemove: (r: DesignRow) => void;
}) {
  const sort = useSort(
    rows,
    {
      year: yearOf,
      type: (r) => r.type,
      grade: (r) => r.grade * 10 + r.semester,
      hours: (r) => r.hours ?? 0,
      name: (r) => r.name,
      fill: (r) => semesterFill(r, all).left,
      status: (r) => (r.errorCount === 0 ? 0 : 1),
      updated: (r) => r.updatedAt,
    },
    (a, b) => byYearThenSaved(yearOrder(a), yearOrder(b)),
  );
  if (rows.length === 0) return <Card><p className="text-gray-600">조건에 맞는 설계가 없어요.</p></Card>;
  return (
    <Card className="overflow-x-auto">
      {/* 명칭 말고는 내용 폭만큼만(w-px), 남는 폭은 모두 명칭. 제목과 내용은 가운데 정렬(명칭만 왼쪽) */}
      <table className="w-full text-sm whitespace-nowrap [&_td]:px-1.5 [&_td]:py-2 [&_th]:px-1.5">
        <thead className="text-xs text-gray-500">
          <tr>
            <SortTh label="학년도" k="year" sort={sort} className={NARROW} />
            <SortTh label="유형" k="type" sort={sort} className={NARROW} />
            <SortTh label="학년-학기" k="grade" sort={sort} className={NARROW} />
            <SortTh label="차시" k="hours" sort={sort} className={NARROW} />
            <SortTh label="명칭" k="name" sort={sort} className="text-left" />
            <SortTh label="학기 편성" k="fill" sort={sort} className={NARROW} />
            <SortTh label="상태" k="status" sort={sort} className={NARROW} />
            <SortTh label="마지막 저장" k="updated" sort={sort} className={NARROW} />
            <th className={`p-2 ${NARROW}`}>문서</th>
            <th className={`p-2 ${NARROW}`}>복제</th>
            <th className={`p-2 ${NARROW}`}>삭제</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 text-center">
          {sort.sorted.map((r) => (
            <tr key={r.id} className="hover:bg-gray-50">
              <td className="p-2">{yearOf(r)}</td>
              <td className="p-2">
                <TypeTag type={r.type} />
              </td>
              <td className="p-2">
                {r.grade}-{r.semester}
              </td>
              <td className="p-2">{typeof r.hours === "number" ? `${r.hours}차시` : "-"}</td>
              <td className="w-full max-w-0 text-left font-semibold">
                <button type="button" onClick={() => onOpen(r)} title={`${r.name} — 눌러서 설계 열기`} className="block max-w-full truncate text-left text-brand-800 hover:text-brand-600 hover:underline">
                  {r.name || "(이름 없음)"}
                </button>
              </td>
              <td className="p-2">
                <SemesterBadge row={r} rows={all} />
              </td>
              <td className="p-2">
                <span className="flex items-center justify-center gap-1">
                  <StatusBadge compact errors={r.errorCount} warnings={0} type={r.type} progress={r.progress} />
                  {r.warningCount > 0 && (
                    <button type="button" onClick={() => onWarnings(r)} className="rounded-lg border border-orange-300 bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-700 hover:bg-orange-100">
                      확인 {r.warningCount}
                    </button>
                  )}
                  {bandStatus(r.grade, Number(yearOf(r)), checks, all).complete ? (
                    <span className="rounded-lg border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700">✓ 시수점검 완료</span>
                  ) : (
                    <button type="button" onClick={() => onHours(r)} className="rounded-lg border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600 hover:bg-red-100">
                      ⚠ 시수점검
                    </button>
                  )}
                </span>
              </td>
              <td className="p-2 text-xs text-gray-500">{shortDate(r.updatedAt)}</td>
              <td className="p-2 text-center">
                <button
                  type="button"
                  disabled={!docReady(r) || busyId === r.id}
                  title={docReady(r) ? "문서(.docx) 내려받기" : "설계를 완성하면(오류 0개, 체크리스트 모두 확인) 내려받을 수 있어요"}
                  onClick={() => onDownload(r)}
                  className="inline-flex rounded-lg p-1.5 text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent"
                >
                  {busyId === r.id ? "…" : <DownloadIcon />}
                </button>
              </td>
              <td className="p-2 text-center">
                <button type="button" onClick={() => onDuplicate(r)} className="rounded-full border border-brand-100 bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700 hover:bg-brand-100">
                  복제
                </button>
              </td>
              <td className="p-2 text-center">
                <button type="button" onClick={() => onRemove(r)} className="rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-600 hover:bg-red-100">
                  삭제
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
