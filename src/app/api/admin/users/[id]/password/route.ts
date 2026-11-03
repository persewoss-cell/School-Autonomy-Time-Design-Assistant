import { getRepo, handle, json, requireAdmin } from "@/server/context";
import { setPasswordByAdmin } from "@/server/services";

type Ctx = { params: Promise<{ id: string }> };

/** 관리자: 학교 비밀번호 새로 정하기 { password, passwordConfirm } */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const repo = await getRepo();
  const admin = await requireAdmin(repo);
  await setPasswordByAdmin(repo, admin, (await params).id, await req.json().catch(() => ({})));
  return json({ ok: true });
});
