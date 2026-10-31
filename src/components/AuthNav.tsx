"use client";

import Link from "next/link";
import { api } from "@/lib/api";
import { useMe } from "./useMe";
import { LoginGateLink } from "./LoginGate";

export function AuthNav() {
  const me = useMe();
  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/";
  };
  const link = "hover:text-brand-700";
  return (
    <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
      <LoginGateLink href="/designs/new" className={link}>새 설계</LoginGateLink>
      <LoginGateLink href="/hours" className={link}>시수 점검</LoginGateLink>
      {me?.user && <Link href="/designs" className={link}>설계 현황</Link>}
      {me?.user?.role === "admin" && <Link href="/admin" className={`${link} font-semibold text-brand-700`}>관리자</Link>}
      {me?.enabled && !me.user && (
        <>
          <Link href="/signup" className={link}>회원가입</Link>
          <Link href="/login" className="rounded-lg bg-brand-600 px-3 py-1 text-white hover:bg-brand-700">로그인</Link>
        </>
      )}
      {me?.user && (
        <span className="flex items-center gap-3">
          <Link href="/account/password" className="text-gray-400 hover:text-brand-700">비밀번호 변경</Link>
          <button type="button" onClick={logout} className="text-gray-400 hover:text-red-600">로그아웃</button>
          {/* 로그인한 학교 (누르는 버튼은 아님) */}
          <span className="rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">{me.user.schoolName}</span>
        </span>
      )}
      {me && !me.enabled && <Link href="/status" className={link}>설정 확인</Link>}
    </nav>
  );
}
