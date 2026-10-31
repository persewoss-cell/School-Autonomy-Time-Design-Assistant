"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";
import { useMe } from "./useMe";
import { LoginGateLink } from "./LoginGate";

/** 메뉴가 가리키는 화면에 있는지 (설계 현황은 설계 열기 화면 포함, 새 설계 제외) */
function isActive(path: string, href: string): boolean {
  if (href === "/designs") return path === "/designs" || (path.startsWith("/designs/") && !path.startsWith("/designs/new"));
  return path === href || path.startsWith(`${href}/`);
}

export function AuthNav() {
  const me = useMe();
  const path = usePathname() ?? "";
  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/";
  };
  // 지금 보고 있는 화면은 연한 초록 알약 배경 + 진한 초록 굵은 글자 (사용자 결정, 2026-10-31)
  const link = (href: string) =>
    `rounded-full px-3 py-1 transition ${isActive(path, href) ? "bg-brand-100 font-semibold text-brand-700" : "hover:bg-gray-100 hover:text-brand-700"}`;
  return (
    <nav className="flex flex-wrap items-center gap-x-1 gap-y-1 text-sm text-gray-600">
      <LoginGateLink href="/designs/new" className={link("/designs/new")}>새 설계</LoginGateLink>
      {me?.user && <Link href="/shared" className={link("/shared")}>가져오기</Link>}
      <LoginGateLink href="/hours" className={link("/hours")}>시수 점검</LoginGateLink>
      {me?.user && <Link href="/designs" className={link("/designs")}>설계 현황</Link>}
      {me?.user?.role === "admin" && <Link href="/admin" className={link("/admin")}>관리자</Link>}
      {me?.enabled && !me.user && (
        <>
          <Link href="/signup" className={link("/signup")}>회원가입</Link>
          <Link href="/login" className="ml-2 rounded-lg bg-brand-600 px-3 py-1 text-white hover:bg-brand-700">로그인</Link>
        </>
      )}
      {me?.user && (
        <span className="ml-2 flex items-center gap-3">
          <Link href="/account/password" className={isActive(path, "/account/password") ? "font-semibold text-brand-700" : "text-gray-400 hover:text-brand-700"}>
            비밀번호 변경
          </Link>
          <button type="button" onClick={logout} className="text-gray-400 hover:text-red-600">로그아웃</button>
          {/* 로그인한 학교 (누르는 버튼은 아님) */}
          <span className="rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">{me.user.schoolName}</span>
        </span>
      )}
      {me && !me.enabled && <Link href="/status" className={link("/status")}>설정 확인</Link>}
    </nav>
  );
}
