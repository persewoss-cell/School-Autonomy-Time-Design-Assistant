import { SharedDocxView } from "@/components/SharedDocxView";

export const metadata = { title: "설계 문서(.docx) · 학교자율시간 설계 도우미 앱" };

export default async function SharedDocxPage({ params }: { params: Promise<{ id: string }> }) {
  return <SharedDocxView id={(await params).id} />;
}
