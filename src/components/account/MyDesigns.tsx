"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { DesignDoc } from "@/domain/types";
import { api } from "@/lib/api";
import { stepsFor } from "../wizard/Wizard";
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
  progress?: { stepKey: string; maxIndex: number } | null;
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
            <div
              key={r.id}
              role="link"
              tabIndex={0}
              onClick={() => router.push(`/designs/${r.id}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter") router.push(`/designs/${r.id}`);
              }}
              className="cursor-pointer space-y-3 rounded-2xl border-2 border-transparent bg-white p-6 shadow-sm transition hover:border-brand-500 hover:shadow-md focus:border-brand-500 focus:outline-none"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm text-gray-500">{r.type === "subject" ? "과목" : "활동"} · {r.grade}학년 {r.semester}학기</p>
                  <p className="text-xl font-bold">{r.name || "(이름 없음)"}</p>
                </div>
                <StatusBadge errors={r.errorCount} warnings={r.warningCount} type={r.type} progress={r.progress} />
              </div>
              <p className="text-sm text-gray-400">마지막 저장 {fmtDate(r.updatedAt)}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void duplicate(r.id);
                  }}
                  className="rounded-lg border border-brand-100 bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-700 hover:bg-brand-100"
                >
                  복제
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void remove(r);
                  }}
                  className="rounded-lg border border-red-100 bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-100"
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
