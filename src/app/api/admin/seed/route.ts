import { readFile } from "node:fs/promises";
import path from "node:path";
import { getRepo, handle, json, requireAdmin } from "@/server/context";
import { seedGwangyang } from "@/server/seed";

export const dynamic = "force-dynamic";

/** 관리자: 광양중동초 자료(설계·시수 편성표·예시안) 넣기. 이미 있는 것은 건너뜀 */
export const POST = handle(async () => {
  const repo = await getRepo();
  const admin = await requireAdmin(repo);
  const dir = path.join(process.cwd(), "data", "seed", "examples");
  return json(await seedGwangyang(repo, admin, (name) => readFile(path.join(dir, `${name}.pdf`))));
});
