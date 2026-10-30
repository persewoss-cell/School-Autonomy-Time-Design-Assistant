import { getRepo, handle, json, requireAdmin } from "@/server/context";
import { publicUser } from "@/server/services";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const repo = await getRepo();
  await requireAdmin(repo);
  const [users, designs] = await Promise.all([repo.users.list(), repo.designs.listAll()]);
  return json({
    users: users.map((u) => ({
      ...publicUser(u),
      resetRequest: u.resetRequest,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
      designCount: designs.filter((d) => d.ownerId === u.id).length,
    })),
  });
});
