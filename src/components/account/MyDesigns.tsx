"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { DesignDoc } from "@/domain/types";
import { api } from "@/lib/api";
import { Card } from "../ui";
import { useMe } from "../useMe";

export interface DesignRow {
  id: string;
  name: string;
  type: "subject" | "activity";
  grade: number;
  semester: number;
  schoolName: string;
  errorCount: number;
  warningCount: number;
  updatedAt: string;
  owner?: string;
}

export const fmtDate = (s: string | null | undefined) => (s ? new Date(s).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" }) : "-");

export function StatusBadge({ errors, warnings }: { errors: number; warnings: number }) {
  return errors === 0 ? (
    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">완성{warnings ? ` · 확인 ${warnings}` : ""}</span>
  ) : (
    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">작성 중 · 오류 {errors}</span>
  );
}

export function MyDesigns() {
  const me = useMe();
  const [rows, setRows] = useState<DesignRow[] | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(() => {
    api<{ designs: DesignRow[] }>("/api/designs")
      .then((r) => setRows(r.designs))
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (me?.user) load();
  }, [me, load]);

  const duplicate = async (id: string) => {
    const { design } = await api<{ design: { doc: DesignDoc } }>(`/api/designs/${id}`);
    const doc = structuredClone(design.doc);
    doc.basic.name = `${doc.basic.name} (복사본)`.slice(0, 40);
    await api("/api/designs", { method: "POST", body: { doc } });
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
        <h1 className="text-xl font-bold">내 설계</h1>
        <p className="text-gray-600">{me.enabled ? "로그인하면 저장한 설계를 볼 수 있어요." : "저장 기능이 아직 설정되지 않았습니다."}</p>
        {me.enabled && <Link href="/login" className="font-semibold text-brand-600 underline">로그인</Link>}
      </Card>
    );
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">내 설계</h1>
        <Link href="/designs/new" className="rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white hover:bg-brand-700">+ 새 설계</Link>
      </div>
      {error && <p className="text-red-700">{error}</p>}
      {rows === null ? (
        <p className="text-gray-500">불러오는 중…</p>
      ) : rows.length === 0 ? (
        <Card><p className="text-gray-600">아직 저장한 설계가 없어요. 새 설계를 시작해 보세요.</p></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((r) => (
            <Card key={r.id} className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-gray-500">{r.type === "subject" ? "과목" : "활동"} · {r.grade}학년 {r.semester}학기</p>
                  <p className="text-lg font-bold">{r.name || "(이름 없음)"}</p>
                </div>
                <StatusBadge errors={r.errorCount} warnings={r.warningCount} />
              </div>
              <p className="text-xs text-gray-400">마지막 저장 {fmtDate(r.updatedAt)}</p>
              <div className="flex gap-3 text-sm">
                <Link href={`/designs/${r.id}`} className="font-semibold text-brand-600">열기</Link>
                <button type="button" onClick={() => duplicate(r.id)} className="text-gray-500 hover:text-brand-600">복제</button>
                <button type="button" onClick={() => remove(r)} className="text-gray-400 hover:text-red-600">삭제</button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
