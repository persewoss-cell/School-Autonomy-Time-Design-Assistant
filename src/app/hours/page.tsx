import { Suspense } from "react";
import { HoursChecker } from "@/components/hours/HoursChecker";

export const metadata = { title: "시수 점검 · 학교자율시간 설계 도우미 앱" };

export default function HoursPage() {
  return (
    <Suspense fallback={<p className="text-gray-500">불러오는 중…</p>}>
      <HoursChecker />
    </Suspense>
  );
}
