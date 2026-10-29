import { getRepo, handle, json, requireAdmin } from "@/server/context";
import { updateUserByAdmin } from "@/server/services";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const repo = await getRepo();
  const admin = await requireAdmin(repo);
  const body = (await req.json().catch(() => ({}))) as { status?: "pending" | "active" | "blocked"; role?: "teacher" | "admin" };
  await updateUserByAdmin(repo, admin, (await params).id, body);
  return json({ ok: true });
});
