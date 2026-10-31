import { getRepo, handle, json, requireAdmin } from "@/server/context";

export const dynamic = "force-dynamic";

/** 이용 기록: 최근 것부터 ?skip=0&limit=30 (limit=all 이면 전체) */
export const GET = handle(async (req: Request) => {
  const repo = await getRepo();
  await requireAdmin(repo);
  const q = new URL(req.url).searchParams;
  const skip = Math.max(0, Number(q.get("skip")) || 0);
  const all = q.get("limit") === "all";
  const limit = all ? 100_000 : Math.min(200, Math.max(1, Number(q.get("limit")) || 30));
  const [logs, total] = await Promise.all([repo.logs.list(limit, skip), repo.logs.count()]);
  return json({ logs, total });
});
