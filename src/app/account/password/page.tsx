import { ChangePassword } from "@/components/account/ChangePassword";

export const metadata = { title: "비밀번호 바꾸기 · 학교자율시간 설계 도우미 앱" };

export default async function PasswordPage({ searchParams }: { searchParams: Promise<{ first?: string }> }) {
  return <ChangePassword first={(await searchParams).first === "1"} />;
}
