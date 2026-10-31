import { getRepo, handle, json, requireAdmin } from "@/server/context";
import { createUsersByAdmin, type BulkRow } from "@/server/services";

export const dynamic = "force-dynamic";

/** 관리자: 학교 계정 일괄·개별 등록 { rows: [{ region, schoolName, password }] } */
export const POST = handle(async (req: Request) => {
  const repo = await getRepo();
  const admin = await requireAdmin(repo);
  const body = (await req.json().catch(() => ({}))) as { rows?: BulkRow[] };
  return json({ results: await createUsersByAdmin(repo, admin, body.rows ?? []) });
});
