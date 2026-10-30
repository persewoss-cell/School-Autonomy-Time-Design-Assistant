import { env } from "@/lib/env";
import { getRepo, handle, json, setSession } from "@/server/context";
import { publicUser, signup } from "@/server/services";

export const POST = handle(async (req: Request) => {
  const repo = await getRepo();
  const user = await signup(repo, await req.json().catch(() => null), env.adminSchools);
  if (user.status === "active") await setSession(user.id);
  return json({ user: publicUser(user) }, 201);
});
