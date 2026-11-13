import { ActingBanner } from "@/components/ActingBanner";
import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { AuthNav } from "@/components/AuthNav";
import { ToastHost } from "@/components/guide";
import { VisitPing } from "@/components/VisitPing";

export const metadata: Metadata = {
  title: "학교자율시간 설계 도우미 앱",
  description: "초등학교 학교자율시간 과목·활동 설계를 단계별로 돕는 서비스",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
      </head>
      <body className="min-h-screen font-sans">
        {/* 관리자가 학교 화면을 보는 중일 때만 보임 (고정 머리글 높이가 바뀌지 않게 머리글 밖에) */}
        <ActingBanner />
        <header className="sticky top-0 z-30 border-b border-gray-200 bg-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3">
            <Link href="/" className="flex items-center gap-2 text-lg font-bold text-brand-700">
              {/* 앱 아이콘: 시계(7시) + 펼친 책 = 학교자율시간 (사용자가 준 그림). 브라우저 탭 아이콘은 src/app/icon.png */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="" width={28} height={28} className="h-7 w-7" />
              학교자율시간 설계 도우미 앱
            </Link>
            <AuthNav />
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        <footer className="py-8 text-center text-xs text-gray-400">
          만든 이: 광양중동초등학교 강형권, 강지훈 선생님 / 문의: 나이스 업무메일 또는 메신저
        </footer>
        <ToastHost />
        <VisitPing />
      </body>
    </html>
  );
}
