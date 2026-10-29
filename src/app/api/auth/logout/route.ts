import { clearSession, handle, json } from "@/server/context";

export const POST = handle(async () => {
  await clearSession();
  return json({ ok: true });
});
