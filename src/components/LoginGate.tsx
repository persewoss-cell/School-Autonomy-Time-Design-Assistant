"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Modal } from "./Modal";
import { loadMe, useMe } from "./useMe";

/** 로그인하지 않았을 때의 제한 (팝업·상단 경고에 같이 씀) */
export const GUEST_LIMIT = "로그인하지 않으면 설계·시수 점검은 할 수 있지만, 이 브라우저에만 임시 저장되고 문서(.docx)로 내려받을 수 없어요.";

/**
 * 새 설계·시수 점검으로 가는 링크. 로그인하지 않았으면 먼저 경고 팝업을 띄운다.
 * [체험하기] → 그대로 이동, [로그인] → 로그인 화면, ✕ → 닫기
 */
export function LoginGateLink({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  const me = useMe();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const guest = !!me?.enabled && !me.user;
  return (
    <>
      <Link
        href={href}
        className={className}
        onClick={(e) => {
          if (me && !guest) return;
          e.preventDefault();
          if (guest) return setOpen(true);
          // 아직 로그인 여부를 확인하는 중이면 기다렸다가 판단
          void loadMe().then((m) => (m.enabled && !m.user ? setOpen(true) : router.push(href)));
        }}
      >
        {children}
      </Link>
      {open && (
        <Modal
          title="로그인하지 않았어요"
          onClose={() => setOpen(false)}
          actions={
            <>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  router.push(href);
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50"
              >
                체험하기
              </button>
              <button
                type="button"
                onClick={() => router.push(`/login?next=${encodeURIComponent(href)}`)}
                className="rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white hover:bg-brand-700"
              >
                로그인
              </button>
            </>
          }
        >
          <p>
            로그인하지 않으면 설계·시수 점검은 할 수 있지만, <b className="text-red-600">이 브라우저에만 임시 저장</b>되고{" "}
            <b className="text-red-600">문서(.docx)로 내려받을 수 없어요.</b>
          </p>
        </Modal>
      )}
    </>
  );
}

/** 로그인하지 않았을 때 화면 위에 빨간 경고 줄 */
export function GuestBanner() {
  const me = useMe();
  if (!me?.enabled || me.user) return null;
  return (
    <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
      ⚠ {GUEST_LIMIT}{" "}
      <Link href="/login" className="underline">
        로그인
      </Link>
    </p>
  );
}
