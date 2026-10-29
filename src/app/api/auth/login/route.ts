import { getRepo, handle, json, setSession } from "@/server/context";
import { login, publicUser } from "@/server/services";

export const POST = handle(async (req: Request) => {
  const repo = await getRepo();
  const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  const user = await login(repo, body.email ?? "", body.password ?? "");
  await setSession(user.id);
  return json({ user: publicUser(user) });
});
