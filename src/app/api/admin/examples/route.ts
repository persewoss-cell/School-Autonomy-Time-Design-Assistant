import { getRepo, handle, json, requireAdmin } from "@/server/context";
import { uploadExample } from "@/server/services";

export const dynamic = "force-dynamic";

/** 예시안 올리기 (관리자): form-data — file, schoolYear, type, grade, semester, name */
export const POST = handle(async (req: Request) => {
  const repo = await getRepo();
  const admin = await requireAdmin(repo);
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return json({ error: "파일을 골라 주세요." }, 400);
  const meta = Object.fromEntries(["schoolYear", "type", "grade", "semester", "name"].map((k) => [k, form.get(k)]));
  const example = await uploadExample(repo, admin, meta, { name: file.name, type: file.type, data: Buffer.from(await file.arrayBuffer()) });
  return json({ example }, 201);
});
