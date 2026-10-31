import { SharedDesignView } from "@/components/SharedDesignView";

export const metadata = { title: "타학교 완성 설계안 · 학교자율시간 설계 도우미 앱" };

export default async function SharedDesignPage({ params }: { params: Promise<{ id: string }> }) {
  return <SharedDesignView id={(await params).id} />;
}
