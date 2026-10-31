import { isAccountEnabled } from "@/lib/env";
import { currentUser, getRepo, handle, json } from "@/server/context";
import { publicUser } from "@/server/services";

export const dynamic = "force-dynamic";

/** 지금 로그인한 사용자. 저장 기능이 꺼져 있으면 enabled: false */
export const GET = handle(async () => {
  if (!isAccountEnabled()) return json({ enabled: false, user: null });
  const user = await currentUser(await getRepo());
  return json({ enabled: true, user: user ? publicUser(user) : null, acting: user?.actingAdmin ? { adminSchool: user.actingAdmin.schoolName } : null });
});
