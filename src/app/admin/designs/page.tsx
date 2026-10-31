import { Suspense } from "react";
import { AdminDesigns } from "@/components/admin/AdminPages";

export default function AdminDesignsPage() {
  return (
    <Suspense fallback={<p className="text-gray-500">불러오는 중…</p>}>
      <AdminDesigns />
    </Suspense>
  );
}
