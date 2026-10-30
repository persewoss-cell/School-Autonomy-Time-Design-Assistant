import { getRepo, handle, json, requireUser } from "@/server/context";
import { saveHourCheck } from "@/server/services";

export const dynamic = "force-dynamic";

/** 학년 화면 하나의 시수 점검 저장 */
export const PUT = handle(async (req: Request, ctx: { params: Promise<{ grade: string }> }) => {
  const repo = await getRepo();
  const user = await requireUser(repo);
  const { grade } = await ctx.params;
  const body = (await req.json().catch(() => null)) as { check?: unknown } | null;
  await saveHourCheck(repo, user, Number(grade), body?.check);
  return json({ ok: true });
});
