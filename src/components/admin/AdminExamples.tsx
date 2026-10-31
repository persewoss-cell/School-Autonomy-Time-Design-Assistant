"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { fileSize, type ExampleRow } from "../Examples";
import { DownloadIcon } from "../icons";
import { Card, Field, TypeTag, inputClass } from "../ui";
import { useLoad } from "./AdminPages";
import { SortTh, useSort } from "./sort";

const nextYear = () => String(new Date().getFullYear() + (new Date().getMonth() >= 2 ? 1 : 0));

/** 관리자: 첫 화면 '예시안 보기'에 나오는 파일 올리기·지우기 */
export function AdminExamples() {
  const { data, error, reload } = useLoad<{ examples: (ExampleRow & { uploadedAt: string })[] }>("/api/examples");
  const [form, setForm] = useState({ schoolYear: nextYear(), type: "activity", grade: "3", semester: "1", name: "" });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const rows = data?.examples ?? [];
  const sort = useSort(rows, {
    year: (r) => r.schoolYear,
    type: (r) => r.type,
    grade: (r) => r.grade * 10 + r.semester,
    name: (r) => r.name,
    uploaded: (r) => r.uploadedAt,
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  const upload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return setMsg({ ok: false, text: "파일을 골라 주세요." });
    setBusy(true);
    setMsg(null);
    try {
      const body = new FormData();
      Object.entries(form).forEach(([k, v]) => body.append(k, v));
      body.append("file", file);
      const res = await fetch("/api/admin/examples", { method: "POST", body });
      const r = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(r.error ?? "올리지 못했어요.");
      setMsg({ ok: true, text: `「${form.name}」을(를) 올렸어요.` });
      setForm({ ...form, name: "" });
      setFile(null);
      reload();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "올리지 못했어요." });
    } finally {
      setBusy(false);
    }
  };
  const remove = async (r: ExampleRow) => {
    if (!confirm(`예시안 「${r.name}」을(를) 지울까요? 첫 화면 목록에서도 사라져요.`)) return;
    await api(`/api/admin/examples/${r.id}`, { method: "DELETE" }).catch((e) => alert(e.message));
    reload();
  };

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <h2 className="font-bold">예시안 올리기</h2>
        <p className="text-sm text-gray-600">첫 화면의 &lsquo;학교자율시간 예시안 보기&rsquo;에 나와요. 로그인하지 않은 선생님도 내려받을 수 있으니 학생 개인정보가 없는 문서만 올려 주세요.</p>
        <form onSubmit={upload} className="grid gap-3 sm:grid-cols-6">
          <Field label="학년도">
            <input className={inputClass} value={form.schoolYear} onChange={set("schoolYear")} />
          </Field>
          <Field label="유형">
            <select className={inputClass} value={form.type} onChange={set("type")}>
              <option value="activity">활동</option>
              <option value="subject">과목</option>
            </select>
          </Field>
          <Field label="학년">
            <select className={inputClass} value={form.grade} onChange={set("grade")}>
              {[3, 4, 5, 6].map((g) => (
                <option key={g} value={g}>
                  {g}학년
                </option>
              ))}
            </select>
          </Field>
          <Field label="학기">
            <select className={inputClass} value={form.semester} onChange={set("semester")}>
              <option value="1">1학기</option>
              <option value="2">2학기</option>
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="과목·활동 이름">
              <input className={inputClass} value={form.name} onChange={set("name")} placeholder="예: 지구마을 첫걸음" />
            </Field>
          </div>
          <div className="sm:col-span-4">
            <Field label="파일 (hwp·hwpx·docx·pdf, 4MB 이하)">
              <input type="file" accept=".hwp,.hwpx,.docx,.pdf" className="block w-full text-sm" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </Field>
          </div>
          <div className="flex items-end sm:col-span-2">
            <button type="submit" disabled={busy} className="w-full rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white hover:bg-brand-700 disabled:bg-gray-300">
              {busy ? "올리는 중…" : "올리기"}
            </button>
          </div>
        </form>
        {msg && <p className={`rounded-lg p-2 text-sm ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
      </Card>
      {error && <p className="text-red-700">{error}</p>}
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-left text-xs text-gray-500">
            <tr>
              <SortTh label="학년도" k="year" sort={sort} />
              <SortTh label="활동/과목" k="type" sort={sort} />
              <SortTh label="학년·학기" k="grade" sort={sort} />
              <SortTh label="이름" k="name" sort={sort} />
              <SortTh label="올린 날" k="uploaded" sort={sort} />
              <th className="p-2">파일</th>
              <th className="p-2">삭제</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sort.sorted.map((r) => (
              <tr key={r.id}>
                <td className="p-2">{r.schoolYear}</td>
                <td className="p-2">
                  <TypeTag type={r.type} />
                </td>
                <td className="p-2">
                  {r.grade}학년 {r.semester}학기
                </td>
                <td className="p-2 font-semibold">{r.name}</td>
                <td className="p-2 text-xs text-gray-500">{new Date(r.uploadedAt).toLocaleDateString("ko-KR")}</td>
                <td className="p-2">
                  <a href={`/api/examples/${r.id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
                    {r.fileName} ({fileSize(r.size)}) <DownloadIcon className="h-3.5 w-3.5" />
                  </a>
                </td>
                <td className="p-2">
                  <button type="button" onClick={() => void remove(r)} className="rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-600 hover:bg-red-100">
                    삭제
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-gray-500">
                  아직 올린 예시안이 없어요.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
