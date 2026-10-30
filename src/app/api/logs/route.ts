import { isAccountEnabled } from "@/lib/env";
import { currentUser, getRepo, handle, json } from "@/server/context";

/** 화면에서 보내는 이용 기록 (문서 내려받기, AI 답 읽기 실패). 프롬프트·답 원문은 받지 않는다. */
export const POST = handle(async (req: Request) => {
  if (!isAccountEnabled()) return json({ ok: false });
  const repo = await getRepo();
  const user = await currentUser(repo);
  const body = (await req.json().catch(() => ({}))) as { kind?: string; detail?: string; designId?: string };
  if (body.kind !== "download" && body.kind !== "parse_fail") return json({ error: "알 수 없는 기록" }, 400);
  await repo.logs.add({
    kind: body.kind,
    userId: user?.id,
    school: user?.schoolName,
    designId: typeof body.designId === "string" ? body.designId.slice(0, 40) : undefined,
    detail: typeof body.detail === "string" ? body.detail.slice(0, 200) : undefined,
  });
  return json({ ok: true });
});
