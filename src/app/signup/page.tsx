import { AuthForm } from "@/components/account/AuthForm";

export const metadata = { title: "회원가입 · 학교자율시간 설계 도우미 앱" };

export default function SignupPage() {
  return <AuthForm mode="signup" />;
}
