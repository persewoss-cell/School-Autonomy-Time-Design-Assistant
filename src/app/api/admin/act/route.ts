import { getRepo, handle, json, requireAdmin, setActing } from "@/server/context";
import { ServiceError } from "@/server/services";

export const dynamic = "force-dynamic";

/** 관리자: 그 학교로 들어가 보기 시작 { userId } */
export const POST = handle(async (req: Request) => {
  const repo = await getRepo();
  const admin = await requireAdmin(repo);
  const { userId } = (await req.json().catch(() => ({}))) as { userId?: string };
  const target = userId ? await repo.users.findById(userId) : null;
  if (!target) throw new ServiceError(404, "학교를 찾을 수 없습니다.");
  await setActing(target.id === admin.id ? null : target.id);
  return json({ ok: true });
});

/** 관리자: 학교 화면 보기 끝내기 */
export const DELETE = handle(async () => {
  await setActing(null);
  return json({ ok: true });
});
