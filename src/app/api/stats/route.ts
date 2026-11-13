import { isAccountEnabled } from "@/lib/env";
import { kstDay } from "@/domain/usageStats";
import { currentUser, getRepo, handle, json } from "@/server/context";

/**
 * 로그인 없이 세는 하루 숫자: 방문자(하루 한 브라우저 1번), 체험하기.
 * 누가 했는지(IP·학교 등)는 남기지 않고 날짜별 숫자만 더한다. 관리자는 세지 않는다.
 */
export const POST = handle(async (req: Request) => {
  if (!isAccountEnabled()) return json({ ok: false });
  const body = (await req.json().catch(() => ({}))) as { key?: string };
  if (body.key !== "visit" && body.key !== "trial") return json({ error: "알 수 없는 기록" }, 400);
  const repo = await getRepo();
  const user = await currentUser(repo).catch(() => null);
  if (user?.role === "admin" || user?.actingAdmin) return json({ ok: true, skipped: true });
  await repo.counters.inc(kstDay(new Date()), body.key);
  return json({ ok: true });
});
