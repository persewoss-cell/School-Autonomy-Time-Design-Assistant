import { AuthForm } from "@/components/account/AuthForm";

export const metadata = { title: "로그인 · 학교자율시간 설계 도우미 앱" };

export default function LoginPage() {
  return <AuthForm mode="login" />;
}
