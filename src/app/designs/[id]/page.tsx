import { EditDesign } from "@/components/account/DesignEditor";

export const metadata = { title: "설계 · 학교자율시간 설계 도우미 앱" };

export default async function DesignPage({ params }: { params: Promise<{ id: string }> }) {
  return <EditDesign id={(await params).id} />;
}
