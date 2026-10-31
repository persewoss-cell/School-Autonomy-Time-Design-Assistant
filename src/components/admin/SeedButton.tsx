"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Modal } from "../Modal";

interface SeedResult {
  designs: { added: number; skipped: number };
  hours: { added: number; skipped: number };
  examples: { added: number; skipped: number };
}

/** 관리자 대시보드: 광양중동초 자료(설계 9개·2026 시수 편성표·예시안 9개) 넣기. 이미 있는 것은 건너뜀 */
export function SeedButton() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SeedResult | null>(null);
  const [error, setError] = useState("");
  const close = () => {
    setOpen(false);
    setResult(null);
    setError("");
  };
  const run = async () => {
    setBusy(true);
    setError("");
    try {
      setResult(await api<SeedResult>("/api/admin/seed", { method: "POST" }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const row = (label: string, r: { added: number; skipped: number }) => (
    <li>
      {label}: 새로 넣음 <b>{r.added}</b>개{r.skipped > 0 && <span className="text-gray-500"> · 이미 있어 건너뜀 {r.skipped}개</span>}
    </li>
  );
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="rounded-lg border border-brand-600 px-3 py-1.5 text-sm font-semibold text-brand-700 hover:bg-brand-50">
        광양중동초 자료 넣기
      </button>
      {open && (
        <Modal
          tone="brand"
          title="광양중동초 자료 넣기"
          onClose={close}
          actions={
            result ? (
              <button type="button" onClick={close} className="rounded-lg bg-brand-600 px-4 py-2 text-white hover:bg-brand-700">
                닫기
              </button>
            ) : (
              <>
                <button type="button" onClick={close} className="rounded-lg border px-4 py-2 hover:bg-gray-50">
                  취소
                </button>
                <button type="button" disabled={busy} onClick={() => void run()} className="rounded-lg bg-brand-600 px-4 py-2 text-white hover:bg-brand-700 disabled:opacity-50">
                  {busy ? "넣는 중…" : "넣기"}
                </button>
              </>
            )
          }
        >
          {result ? (
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {row("설계 (설계 현황)", result.designs)}
              {row("2026학년도 시수 점검", result.hours)}
              {row("예시안 파일", result.examples)}
            </ul>
          ) : (
            <div className="space-y-2 text-sm">
              <p>광양중동초등학교 계정에 아래 자료를 넣어요.</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>설계 9개: 지구마을 첫걸음·이야기·히어로·탐험대(2026, 활동), 디지털 탐험대 3~6(2026, 과목), 지구촌, 함께 걷는 우리(2024, 활동)</li>
                <li>2026학년도 3~6학년 시수 점검 (편성표 숫자 그대로)</li>
                <li>예시안 파일 9개 (첫 화면 &lsquo;예시안 보기&rsquo;)</li>
              </ul>
              <p className="text-gray-500">이미 있는 설계(같은 이름·학년도)·시수 점검(같은 학년도·학년)·예시안은 건너뛰어서, 여러 번 눌러도 겹치지 않아요.</p>
              {error && <p className="font-semibold text-red-700">{error}</p>}
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
