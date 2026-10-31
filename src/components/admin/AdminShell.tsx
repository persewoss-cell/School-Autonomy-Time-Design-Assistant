"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMe } from "../useMe";
import { Card } from "../ui";

const TABS = [
  ["/admin", "대시보드"],
  ["/admin/users", "사용학교"],
  ["/admin/designs", "전체 설계"],
  ["/admin/examples", "예시안"],
  ["/admin/logs", "이용 기록"],
] as const;

/** 관리자 화면 틀: 관리자가 아니면 내용을 보여 주지 않는다 (API도 따로 막음) */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const me = useMe();
  const path = usePathname();
  if (!me) return <p className="text-gray-500">확인 중…</p>;
  if (me.user?.role !== "admin") {
    return (
      <Card className="space-y-2">
        <h1 className="text-xl font-bold">관리자 모드</h1>
        <p className="text-gray-600">관리자만 볼 수 있습니다.{!me.user && me.enabled ? " 먼저 로그인해 주세요." : ""}</p>
        {!me.user && me.enabled && <Link href="/login" className="font-semibold text-brand-600 underline">로그인</Link>}
      </Card>
    );
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-3 text-2xl font-bold">관리자 모드</h1>
        {TABS.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className={`rounded-full px-3 py-1 text-sm ${
              (href === "/admin" ? path === href : path.startsWith(href)) ? "bg-brand-600 font-semibold text-white" : "bg-white text-gray-600 hover:bg-brand-50"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>
      {children}
    </div>
  );
}
