"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Packer } from "docx";
import type { DesignDoc } from "@/domain/types";
import { buildDesignDocx, docxFileName } from "@/export/docx";
import { validateDesign } from "@/validation/design";
import { api } from "@/lib/api";
import { DocPreview } from "../wizard/FinalSteps";
import { Card, IssueList, inputClass, TypeTag } from "../ui";
import { fmtDate, StatusBadge, type DesignRow } from "../account/MyDesigns";
import { useMe } from "../useMe";
import { Modal } from "../Modal";
import { enterSchool } from "../ActingBanner";
import { MultiSelect } from "./MultiSelect";
import { SortTh, useSort } from "./sort";
import { BulkUsers } from "./BulkUsers";
import { useSearchParams, useRouter } from "next/navigation";
import type { Issue } from "@/validation/types";

export function useLoad<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const reload = useCallback(() => {
    api<T>(path).then(setData).catch((e) => setError(e.message));
  }, [path]);
  useEffect(reload, [reload]);
  return { data, error, reload };
}

function StatLink({ href, label, value, sub, alert }: { href: string; label: string; value: number; sub: string; alert?: boolean }) {
  return (
    <Link href={href} className="block rounded-2xl border-2 border-transparent bg-white p-4 shadow-sm transition hover:border-brand-500 hover:shadow-md">
      <p className="text-sm text-gray-500">{label} →</p>
      <p className="text-3xl font-bold">{value}</p>
      <p className={`text-xs ${alert ? "font-semibold text-amber-700" : "text-gray-400"}`}>{sub}</p>
    </Link>
  );
}

function Breakdown({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return (
    <Card className="space-y-2">
      <h2 className="font-bold">{title}</h2>
      {entries.length === 0 ? (
        <p className="text-sm text-gray-400">아직 없음</p>
      ) : (
        entries.map(([k, v]) => (
          <div key={k} className="flex items-center gap-2 text-sm">
            <span className="w-28 shrink-0 truncate text-gray-600">{k}</span>
            <span className="h-3 rounded bg-brand-500" style={{ width: `${(v / max) * 60}%` }} />
            <span className="text-gray-500">{v}</span>
          </div>
        ))
      )}
    </Card>
  );
}

interface Stats {
  users: { total: number; pending: number; resetRequests: number; byRegion: Record<string, number> };
  designs: { total: number; complete: number; inProgress: number; byType: Record<string, number>; byGrade: Record<string, number>; bySchool: Record<string, number> };
}

export function AdminDashboard() {
  const { data, error } = useLoad<Stats>("/api/admin/stats");
  if (error) return <p className="text-red-700">{error}</p>;
  if (!data) return <p className="text-gray-500">불러오는 중…</p>;
  return (
    <div className="space-y-4">
      {data.users.resetRequests > 0 && (
        <Link href="/admin/users" className="block rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-800">
          비밀번호 재설정 신청이 {data.users.resetRequests}건 있어요 → 사용학교 화면에서 임시 비밀번호 발급하기
        </Link>
      )}
      {/* 누르면 해당 목록으로 이동 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatLink href="/admin/users" label="가입 학교" value={data.users.total} sub={data.users.pending ? `승인 대기 ${data.users.pending}` : "승인 대기 없음"} alert={data.users.pending > 0} />
        <StatLink href="/admin/designs?status=complete" label="설계 완성" value={data.designs.complete} sub="오류 0개" />
        <StatLink href="/admin/designs?status=progress" label="설계 중" value={data.designs.inProgress} sub="오류가 남은 설계" />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Breakdown title="유형별 설계" data={data.designs.byType} />
        <Breakdown title="학년별 설계" data={data.designs.byGrade} />
        <Breakdown title="시·군·구별 가입 학교" data={data.users.byRegion} />
        <Breakdown title="학교별 설계" data={data.designs.bySchool} />
      </div>
    </div>
  );
}

interface UserRow {
  id: string;
  region: string;
  schoolName: string;
  role: "teacher" | "admin";
  status: "pending" | "active" | "blocked";
  mustChangePassword: boolean;
  resetRequest: { requestedAt: string; contact: string } | null;
  createdAt: string;
  lastLoginAt: string | null;
  designCount: number;
}
const STATUS_LABEL = { pending: "승인 대기", active: "사용 중", blocked: "중지" } as const;

export function AdminUsers() {
  const me = useMe();
  const { data, error, reload } = useLoad<{ users: UserRow[] }>("/api/admin/users");
  const [temp, setTemp] = useState<{ school: string; password: string; contact?: string } | null>(null);
  const update = async (u: UserRow, patch: Partial<Pick<UserRow, "status" | "role">>) => {
    await api(`/api/admin/users/${u.id}`, { method: "PATCH", body: patch }).catch((e) => alert(e.message));
    reload();
  };
  const issueTemp = async (u: UserRow) => {
    if (!confirm(`${u.schoolName}의 비밀번호를 임시 비밀번호로 바꿀까요? 지금 비밀번호로는 더 이상 로그인할 수 없어요.`)) return;
    try {
      const r = await api<{ tempPassword: string }>(`/api/admin/users/${u.id}/reset-password`, { method: "POST" });
      setTemp({ school: u.schoolName, password: r.tempPassword, contact: u.resetRequest?.contact });
      reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "발급하지 못했습니다.");
    }
  };
  if (error) return <p className="text-red-700">{error}</p>;
  if (!data) return <p className="text-gray-500">불러오는 중…</p>;
  const requests = data.users.filter((u) => u.resetRequest);
  return <UsersTable users={data.users} meId={me?.user?.id} requests={requests} temp={temp} setTemp={setTemp} update={update} issueTemp={issueTemp} reload={reload} />;
}

function UsersTable({
  users,
  meId,
  requests,
  temp,
  setTemp,
  update,
  issueTemp,
  reload,
}: {
  users: UserRow[];
  meId?: string;
  requests: UserRow[];
  temp: { school: string; password: string; contact?: string } | null;
  setTemp: (t: null) => void;
  update: (u: UserRow, patch: Partial<Pick<UserRow, "status" | "role">>) => Promise<void>;
  issueTemp: (u: UserRow) => Promise<void>;
  reload: () => void;
}) {
  const sort = useSort(users, {
    region: (u) => u.region,
    school: (u) => u.schoolName,
    status: (u) => u.status,
    role: (u) => u.role,
    designs: (u) => u.designCount,
    created: (u) => u.createdAt,
  });
  const removeUser = async (u: UserRow) => {
    if (!confirm(`「${u.schoolName}」 계정을 삭제할까요?\n이 학교의 설계 ${u.designCount}개와 시수 점검도 함께 지워지고, 되돌릴 수 없어요.`)) return;
    if (prompt(`정말 삭제하려면 학교명(${u.schoolName})을 그대로 입력하세요.`)?.trim() !== u.schoolName) return alert("학교명이 달라 삭제하지 않았어요.");
    await api(`/api/admin/users/${u.id}`, { method: "DELETE" }).catch((e) => alert(e.message));
    reload();
  };
  return (
    <div className="space-y-4">
      <BulkUsers onDone={reload} />
      {temp && (
        <Card className="space-y-2 border-2 border-brand-500">
          <p className="font-bold">{temp.school} 임시 비밀번호</p>
          <p className="font-mono text-2xl tracking-wider">{temp.password}</p>
          <p className="text-sm text-gray-600">
            이 비밀번호는 지금 한 번만 보여요. {temp.contact ? `연락처(${temp.contact})로 ` : ""}학교에 알려 주세요.
            학교에서 이 비밀번호로 로그인하면 새 비밀번호로 바꾸는 화면이 나와요.
          </p>
          <button type="button" className="text-sm text-gray-500 underline" onClick={() => setTemp(null)}>닫기</button>
        </Card>
      )}
      {requests.length > 0 && (
        <Card className="space-y-2 bg-amber-50">
          <h2 className="font-bold text-amber-800">비밀번호 재설정 신청 {requests.length}건</h2>
          {requests.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>
                <b>{u.schoolName}</b> ({u.region}) · 연락처: {u.resetRequest!.contact} · {fmtDate(u.resetRequest!.requestedAt)}
              </span>
              <button type="button" className="rounded-lg bg-brand-600 px-3 py-1 font-semibold text-white" onClick={() => issueTemp(u)}>
                임시 비밀번호 발급
              </button>
            </div>
          ))}
        </Card>
      )}
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="text-left text-xs text-gray-500">
            <tr>
              <SortTh label="지역" k="region" sort={sort} />
              <SortTh label="학교명" k="school" sort={sort} />
              <SortTh label="상태" k="status" sort={sort} />
              <SortTh label="권한" k="role" sort={sort} />
              <SortTh label="설계" k="designs" sort={sort} />
              <SortTh label="가입 / 최근 로그인" k="created" sort={sort} />
              <th className="p-2">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sort.sorted.map((u) => (
              <tr key={u.id}>
                <td className="p-2">{u.region || "-"}</td>
                <td className="p-2">
                  <b>{u.schoolName}</b>
                  {u.mustChangePassword && <span className="ml-1 text-xs text-amber-600">(임시 비밀번호)</span>}
                </td>
                <td className="p-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${u.status === "active" ? "bg-green-100 text-green-700" : u.status === "pending" ? "bg-amber-100 text-amber-700" : "bg-gray-200 text-gray-600"}`}>
                    {STATUS_LABEL[u.status]}
                  </span>
                </td>
                <td className="p-2">{u.role === "admin" ? "관리자" : "학교"}</td>
                <td className="p-2">{u.designCount}</td>
                <td className="p-2 text-xs text-gray-500">{fmtDate(u.createdAt)}<br />{fmtDate(u.lastLoginAt)}</td>
                <td className="space-x-2 p-2 text-xs">
                  {u.id === meId ? (
                    <span className="text-gray-400">(나)</span>
                  ) : (
                    <>
                      {u.status !== "active" && <button type="button" className="font-semibold text-brand-600" onClick={() => update(u, { status: "active" })}>가입 승인</button>}
                      {u.status === "active" && <button type="button" className="text-gray-500 hover:text-red-600" onClick={() => confirm(`${u.schoolName} 계정을 중지할까요?`) && update(u, { status: "blocked" })}>중지</button>}
                      <button type="button" className="text-gray-500 hover:text-brand-600" onClick={() => issueTemp(u)}>임시 비밀번호</button>
                      <button type="button" className="text-gray-500 hover:text-brand-600" onClick={() => confirm("권한을 바꿀까요?") && update(u, { role: u.role === "admin" ? "teacher" : "admin" })}>
                        {u.role === "admin" ? "일반으로" : "관리자로"}
                      </button>
                      <button type="button" className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 font-semibold text-red-600 hover:bg-red-100" onClick={() => void removeUser(u)}>
                        계정 삭제
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

type AdminDesignRow = DesignRow & { owner: string; ownerId: string; hoursComplete: boolean; schoolYear?: string };

/** 관리자: 전체 설계 — 학교·유형·학년 고르기, 제목 세모로 정렬, 상세보기(그 학교로 들어가 보기), 삭제 */
export function AdminDesigns() {
  const { data, error, reload } = useLoad<{ designs: AdminDesignRow[] }>("/api/admin/designs");
  const params = useSearchParams();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [schools, setSchools] = useState<string[]>([]);
  const [type, setType] = useState("");
  const [grades, setGrades] = useState<string[]>([]);
  const [status, setStatus] = useState(params.get("status") ?? "");
  const [warnView, setWarnView] = useState<{ row: AdminDesignRow; issues: Issue[] } | null>(null);
  const all = data?.designs ?? [];
  const schoolOptions = [...new Set(all.map((d) => d.owner))].sort((a, b) => a.localeCompare(b, "ko")).map((v) => ({ value: v, label: v }));
  const rows = useMemo(
    () =>
      all.filter(
        (d) =>
          (schools.length === 0 || schools.includes(d.owner)) &&
          (!type || d.type === type) &&
          (grades.length === 0 || grades.includes(String(d.grade))) &&
          (!status || (status === "complete" ? d.errorCount === 0 : d.errorCount > 0)) &&
          (!q || `${d.name} ${d.owner}`.toLowerCase().includes(q.toLowerCase())),
      ),
    [all, schools, type, grades, status, q],
  );
  const sort = useSort(rows, {
    school: (d) => d.owner,
    type: (d) => d.type,
    grade: (d) => d.grade * 10 + d.semester,
    name: (d) => d.name,
    status: (d) => (d.errorCount === 0 ? 0 : 1),
    updated: (d) => d.updatedAt,
  });
  const showWarnings = async (row: AdminDesignRow) => {
    const { design } = await api<{ design: { doc: DesignDoc } }>(`/api/admin/designs/${row.id}`);
    setWarnView({ row, issues: validateDesign(design.doc).filter((i) => i.level === "warning") });
  };
  const remove = async (row: AdminDesignRow) => {
    if (!confirm(`${row.owner}의 「${row.name}」 설계를 삭제할까요? 되돌릴 수 없어요.`)) return;
    await api(`/api/admin/designs/${row.id}`, { method: "DELETE" }).catch((e) => alert(e.message));
    reload();
  };
  if (error) return <p className="text-red-700">{error}</p>;
  if (!data) return <p className="text-gray-500">불러오는 중…</p>;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input className={`${inputClass} max-w-56`} placeholder="설계 이름·학교 검색" value={q} onChange={(e) => setQ(e.target.value)} />
        <MultiSelect allLabel="전체 학교" options={schoolOptions} selected={schools} onChange={setSchools} />
        <select className={`${inputClass} max-w-32`} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">전체 유형</option>
          <option value="activity">활동</option>
          <option value="subject">과목</option>
        </select>
        <MultiSelect allLabel="전체 학년" options={[3, 4, 5, 6].map((g) => ({ value: String(g), label: `${g}학년` }))} selected={grades} onChange={setGrades} />
        <select
          className={`${inputClass} max-w-32`}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            router.replace(e.target.value ? `/admin/designs?status=${e.target.value}` : "/admin/designs");
          }}
        >
          <option value="">전체 상태</option>
          <option value="complete">완성</option>
          <option value="progress">설계 중</option>
        </select>
        <span className="text-sm text-gray-500">{rows.length}건</span>
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-sm">
          <thead className="text-left text-xs text-gray-500">
            <tr>
              <SortTh label="학교" k="school" sort={sort} />
              <SortTh label="유형" k="type" sort={sort} />
              <SortTh label="학년-학기" k="grade" sort={sort} />
              <SortTh label="명칭" k="name" sort={sort} />
              <SortTh label="상태" k="status" sort={sort} />
              <SortTh label="마지막 저장" k="updated" sort={sort} />
              <th className="p-2 text-center">상세보기</th>
              <th className="p-2 text-center">삭제</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sort.sorted.map((d) => (
              <tr key={d.id}>
                <td className="p-2 font-semibold">{d.owner}</td>
                <td className="p-2">
                  <TypeTag type={d.type} />
                </td>
                <td className="p-2 whitespace-nowrap">
                  {d.grade}-{d.semester}
                </td>
                <td className="p-2">
                  <span className="flex items-center gap-2">
                    <Link href={`/admin/designs/${d.id}`} className="shrink-0 rounded-full border border-gray-300 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-50">
                      요약보기
                    </Link>
                    <span>{d.name || "(이름 없음)"}</span>
                  </span>
                </td>
                <td className="p-2">
                  <span className="flex flex-wrap items-center gap-1">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${d.errorCount === 0 ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                      {d.errorCount === 0 ? "완성" : "설계 중"}
                    </span>
                    {d.warningCount > 0 && (
                      <button type="button" onClick={() => void showWarnings(d)} className="rounded-lg border border-orange-300 bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-700 hover:bg-orange-100">
                        확인 {d.warningCount}
                      </button>
                    )}
                    {d.hoursComplete ? (
                      <span className="rounded-lg border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700">✓ 시수점검 완료</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void enterSchool(d.ownerId, `/hours?grade=${d.grade}&year=${d.schoolYear || 2027}`)}
                        className="rounded-lg border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600 hover:bg-red-100"
                      >
                        ⚠ 시수점검
                      </button>
                    )}
                  </span>
                </td>
                <td className="p-2 text-xs text-gray-500">{fmtDate(d.updatedAt)}</td>
                <td className="p-2 text-center">
                  <button type="button" title="그 학교가 보는 화면 그대로 열기 (고칠 수 있음)" onClick={() => void enterSchool(d.ownerId, `/designs/${d.id}`)} className="rounded-lg px-2 py-1 text-lg hover:bg-gray-100">
                    🔍
                  </button>
                </td>
                <td className="p-2 text-center">
                  <button type="button" onClick={() => void remove(d)} className="rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-600 hover:bg-red-100">
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {warnView && (
        <Modal
          tone="amber"
          title={`확인할 사항 ${warnView.issues.length}개`}
          onClose={() => setWarnView(null)}
          actions={
            <button type="button" onClick={() => setWarnView(null)} className="rounded-lg border border-gray-300 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50">
              닫기
            </button>
          }
        >
          <p className="font-semibold">
            {warnView.row.owner} 「{warnView.row.name}」
          </p>
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

/** 관리자: 설계 하나 읽기 전용으로 보기 + 내려받기 */
export function AdminDesignView({ id }: { id: string }) {
  const { data, error } = useLoad<{ design: { doc: DesignDoc } }>(`/api/admin/designs/${id}`);
  if (error) return <p className="text-red-700">{error}</p>;
  if (!data) return <p className="text-gray-500">불러오는 중…</p>;
  const doc = data.design.doc;
  const download = async () => {
    const url = URL.createObjectURL(await Packer.toBlob(buildDesignDocx(doc)));
    const a = document.createElement("a");
    a.href = url;
    a.download = docxFileName(doc);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="flex items-center gap-1 text-xs text-gray-500"><TypeTag type={doc.basic.type} /> {doc.basic.grade}학년 {doc.basic.semester}학기 · {doc.basic.hours}시간 · {doc.application.schoolName}</p>
          <p className="text-xl font-bold">{doc.basic.name}</p>
        </div>
        <span className="flex gap-2">
          <button type="button" onClick={download} className="rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white hover:bg-brand-700">📄 문서 내려받기</button>
          <Link href="/admin/designs" className="rounded-lg border border-gray-300 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50">
            ← 목록으로
          </Link>
        </span>
      </Card>
      <Card className="space-y-2">
        <h2 className="font-bold">지침 점검 결과</h2>
        <IssueList issues={validateDesign(doc)} />
      </Card>
      <DocPreview doc={doc} />
    </div>
  );
}

interface LogRow { id: string; kind: string; school?: string; detail?: string; designId?: string; createdAt: string }
const KIND_LABEL: Record<string, string> = {
  signup: "가입",
  login: "로그인",
  login_fail: "로그인 실패",
  save: "저장",
  delete: "삭제",
  download: "내려받기",
  parse_fail: "AI 답 읽기 실패",
  reset_request: "비밀번호 재설정 신청",
  password_reset: "임시 비밀번호 발급",
  password_change: "비밀번호 변경",
  admin: "관리자 작업",
};

const LOG_PAGE = 30;

/** 이용 기록: 최근 30개, '더 보기'로 30개씩, '전체 목록 조회'로 모두 (1년 지난 기록은 자동 삭제) */
export function AdminLogs() {
  const [logs, setLogs] = useState<LogRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState("");
  const load = useCallback(async (skip: number, limit: number | "all") => {
    setBusy(true);
    try {
      const r = await api<{ logs: LogRow[]; total: number }>(`/api/admin/logs?skip=${skip}&limit=${limit}`);
      setLogs((prev) => (skip === 0 ? r.logs : [...(prev ?? []), ...r.logs]));
      setTotal(r.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "불러오지 못했어요.");
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    void load(0, LOG_PAGE);
  }, [load]);
  const all = logs ?? [];
  const filtered = all.filter((l) => !kind || l.kind === kind);
  const sort = useSort(filtered, { time: (l) => l.createdAt, kind: (l) => KIND_LABEL[l.kind] ?? l.kind, school: (l) => l.school ?? "", detail: (l) => l.detail ?? "" });
  if (error) return <p className="text-red-700">{error}</p>;
  if (!logs) return <p className="text-gray-500">불러오는 중…</p>;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select className={`${inputClass} max-w-48`} value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">전체 기록</option>
          {Object.entries(KIND_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <span className="text-sm text-gray-500">
          {all.length} / {total}건 보는 중 · 1년 지난 기록은 자동으로 지워져요
        </span>
        {all.length < total && (
          <button type="button" disabled={busy} onClick={() => void load(0, "all")} className="ml-auto rounded-lg border border-brand-500 px-3 py-1.5 text-sm font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-50">
            전체 목록 조회
          </button>
        )}
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-left text-xs text-gray-500">
            <tr>
              <SortTh label="시각" k="time" sort={sort} />
              <SortTh label="종류" k="kind" sort={sort} />
              <SortTh label="학교" k="school" sort={sort} />
              <SortTh label="내용" k="detail" sort={sort} />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sort.sorted.map((l) => (
              <tr key={l.id}>
                <td className="p-2 text-xs text-gray-500">{fmtDate(l.createdAt)}</td>
                <td className="p-2">{KIND_LABEL[l.kind] ?? l.kind}</td>
                <td className="p-2 text-gray-600">{l.school ?? "-"}</td>
                <td className="p-2 text-gray-600">
                  {l.detail}
                  {l.designId && <Link href={`/admin/designs/${l.designId}`} className="ml-2 text-xs text-brand-600">설계 보기</Link>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {all.length < total && (
        <button type="button" disabled={busy} onClick={() => void load(all.length, LOG_PAGE)} className="w-full rounded-lg border border-gray-300 bg-white py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
          {busy ? "불러오는 중…" : `더 보기 (${Math.min(LOG_PAGE, total - all.length)}개 더)`}
        </button>
      )}
    </div>
  );
}
