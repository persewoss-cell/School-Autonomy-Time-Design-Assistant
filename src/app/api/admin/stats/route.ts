import { env } from "@/lib/env";
import { usageStats } from "@/domain/usageStats";
import { getRepo, handle, json, requireAdmin } from "@/server/context";

export const dynamic = "force-dynamic";

/** 관리자 '이용 통계': 최근 30일 날짜별 + 30일 합계 + 전체 누적 (관리자 활동 제외) */
export const GET = handle(async () => {
  const repo = await getRepo();
  await requireAdmin(repo);
  const now = new Date();
  // 이용 기록은 1년 지나면 지워지므로 남아 있는 것 전부
  const [counters, logs, designs, users] = await Promise.all([
    repo.counters.all(),
    repo.logs.since(new Date(now.getTime() - 366 * 86_400_000)),
    repo.designs.listAll(),
    repo.users.list(),
  ]);
  return json(usageStats({ now, counters, logs, designs, users, adminSchools: env.adminSchools }));
});
