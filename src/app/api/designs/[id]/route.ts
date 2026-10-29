import { getRepo, handle, json, requireUser } from "@/server/context";
import { deleteDesign, getDesign, saveDesign } from "@/server/services";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const repo = await getRepo();
  const user = await requireUser(repo);
  const d = await getDesign(repo, user, (await params).id);
  return json({ design: d, mine: d.ownerId === user.id });
});

export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const repo = await getRepo();
  const user = await requireUser(repo);
  const body = (await req.json().catch(() => null)) as { doc?: unknown } | null;
  return json(await saveDesign(repo, user, body?.doc, (await params).id));
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const repo = await getRepo();
  const user = await requireUser(repo);
  await deleteDesign(repo, user, (await params).id);
  return json({ ok: true });
});
