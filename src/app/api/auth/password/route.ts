import { getRepo, handle, json, requireUser } from "@/server/context";
import { changePassword } from "@/server/services";

/** 로그인한 학교의 비밀번호 바꾸기 */
export const POST = handle(async (req: Request) => {
  const repo = await getRepo();
  const user = await requireUser(repo);
  await changePassword(repo, user, await req.json().catch(() => null));
  return json({ ok: true });
});
