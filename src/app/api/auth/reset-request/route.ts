import { getRepo, handle, json } from "@/server/context";
import { requestPasswordReset } from "@/server/services";

/** 비밀번호를 잊은 학교의 재설정 신청 */
export const POST = handle(async (req: Request) => {
  const repo = await getRepo();
  const body = (await req.json().catch(() => ({}))) as { schoolName?: string; contact?: string };
  await requestPasswordReset(repo, body.schoolName ?? "", body.contact ?? "");
  return json({ ok: true });
});
