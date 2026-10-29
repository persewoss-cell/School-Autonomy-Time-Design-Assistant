import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

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
        <header className="border-b border-gray-200 bg-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3">
            <Link href="/" className="text-lg font-bold text-brand-700">
              학교자율시간 설계 도우미 앱
            </Link>
            <nav className="flex gap-4 text-sm text-gray-600">
              <Link href="/designs/new" className="hover:text-brand-700">새 설계</Link>
              <Link href="/hours" className="hover:text-brand-700">시수 점검</Link>
              <Link href="/status" className="hover:text-brand-700">설정 확인</Link>
              <span className="cursor-not-allowed text-gray-300" title="5단계에서 만듭니다">관리자</span>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        <footer className="py-8 text-center text-xs text-gray-400">
          「2027학년도 초등 학교자율시간 설계·운영 지침」(전라남도교육청) 기준 · 학생 개인정보는 입력하지 마세요.
        </footer>
      </body>
    </html>
  );
}
