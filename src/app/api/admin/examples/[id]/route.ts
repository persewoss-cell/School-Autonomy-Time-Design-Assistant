import { getRepo, handle, json, requireAdmin } from "@/server/context";
import { deleteExample } from "@/server/services";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const repo = await getRepo();
  const admin = await requireAdmin(repo);
  await deleteExample(repo, admin, (await params).id);
  return json({ ok: true });
});
