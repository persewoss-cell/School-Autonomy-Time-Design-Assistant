import { getRepo, handle, json, requireAdmin } from "@/server/context";
import { deleteUserByAdmin, updateUserByAdmin } from "@/server/services";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const repo = await getRepo();
  const admin = await requireAdmin(repo);
  const body = (await req.json().catch(() => ({}))) as { status?: "pending" | "active" | "blocked"; role?: "teacher" | "admin" };
  await updateUserByAdmin(repo, admin, (await params).id, body);
  return json({ ok: true });
});

/** 학교 계정 삭제 (설계·시수 점검도 함께) */
export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const repo = await getRepo();
  const admin = await requireAdmin(repo);
  return json(await deleteUserByAdmin(repo, admin, (await params).id));
});
