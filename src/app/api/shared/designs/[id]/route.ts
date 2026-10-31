import { getRepo, handle, json, requireUser } from "@/server/context";
import { getSharedDesign } from "@/server/services";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** 타학교 완성 설계 하나 (보기·내려받기·가져오기) */
export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const repo = await getRepo();
  const user = await requireUser(repo);
  return json(await getSharedDesign(repo, user, (await params).id));
});
