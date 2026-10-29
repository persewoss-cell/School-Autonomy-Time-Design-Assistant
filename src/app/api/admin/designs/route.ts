import { getRepo, handle, json, requireAdmin } from "@/server/context";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const repo = await getRepo();
  await requireAdmin(repo);
  const [designs, users] = await Promise.all([repo.designs.listAll(), repo.users.list()]);
  const owner = new Map(users.map((u) => [u.id, `${u.name} (${u.email})`]));
  return json({ designs: designs.map((d) => ({ ...d, owner: owner.get(d.ownerId) ?? "(탈퇴)" })) });
});
