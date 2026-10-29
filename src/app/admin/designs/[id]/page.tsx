import { AdminDesignView } from "@/components/admin/AdminPages";

export default async function AdminDesignPage({ params }: { params: Promise<{ id: string }> }) {
  return <AdminDesignView id={(await params).id} />;
}
