import { getRepo, handle, json, requireAdmin } from "@/server/context";
import { resetPasswordByAdmin } from "@/server/services";

type Ctx = { params: Promise<{ id: string }> };

/** 관리자: 임시 비밀번호 발급 (응답으로 한 번만 보여 줌, 저장은 암호화된 값만) */
export const POST = handle(async (_req: Request, { params }: Ctx) => {
  const repo = await getRepo();
  const admin = await requireAdmin(repo);
  return json({ tempPassword: await resetPasswordByAdmin(repo, admin, (await params).id) });
});
