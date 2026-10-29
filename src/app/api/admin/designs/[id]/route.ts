import { getRepo, handle, json, requireAdmin } from "@/server/context";
import { getDesign } from "@/server/services";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const repo = await getRepo();
  const admin = await requireAdmin(repo);
  return json({ design: await getDesign(repo, admin, (await params).id) });
});
