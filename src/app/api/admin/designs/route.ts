import { getRepo, handle, json, requireAdmin } from "@/server/context";
import { listAllDesignsForAdmin } from "@/server/services";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const repo = await getRepo();
  await requireAdmin(repo);
  return json({ designs: await listAllDesignsForAdmin(repo) });
});
