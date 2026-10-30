import { getRepo, handle, json, requireUser } from "@/server/context";
import { listHourChecks } from "@/server/services";

export const dynamic = "force-dynamic";

/** 우리 학교 시수 점검 저장본 (학년 화면별) */
export const GET = handle(async () => {
  const repo = await getRepo();
  const user = await requireUser(repo);
  return json({ checks: await listHourChecks(repo, user) });
});
