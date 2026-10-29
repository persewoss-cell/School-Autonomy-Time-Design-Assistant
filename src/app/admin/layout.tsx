import { AdminShell } from "@/components/admin/AdminShell";

export const metadata = { title: "관리자 · 학교자율시간 설계 도우미 앱" };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
