import { getRepo, handle, json, requireAdmin } from "@/server/context";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const repo = await getRepo();
  await requireAdmin(repo);
  return json({ logs: await repo.logs.list(300) });
});
