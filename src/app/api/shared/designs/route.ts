import { getRepo, handle, json, requireUser } from "@/server/context";
import { listSharedDesigns } from "@/server/services";

export const dynamic = "force-dynamic";

/** 타학교 완성 설계안 목록 (로그인한 학교만) */
export const GET = handle(async () => {
  const repo = await getRepo();
  const user = await requireUser(repo);
  return json({ designs: await listSharedDesigns(repo, user) });
});
