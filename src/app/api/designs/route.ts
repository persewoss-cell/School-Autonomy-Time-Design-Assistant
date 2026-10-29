import { getRepo, handle, json, requireUser } from "@/server/context";
import { saveDesign } from "@/server/services";

export const dynamic = "force-dynamic";

/** 내 설계 목록 */
export const GET = handle(async () => {
  const repo = await getRepo();
  const user = await requireUser(repo);
  return json({ designs: await repo.designs.listByOwner(user.id) });
});

/** 새 설계 저장 */
export const POST = handle(async (req: Request) => {
  const repo = await getRepo();
  const user = await requireUser(repo);
  const body = (await req.json().catch(() => null)) as { doc?: unknown } | null;
  return json(await saveDesign(repo, user, body?.doc), 201);
});
