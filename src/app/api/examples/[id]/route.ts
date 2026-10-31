import { getRepo, handle } from "@/server/context";
import { ServiceError } from "@/server/services";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** 예시안 파일 내려받기 (로그인 없이 누구나) */
export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const f = await (await getRepo()).examples.getFile((await params).id);
  if (!f) throw new ServiceError(404, "예시안을 찾을 수 없습니다.");
  return new Response(new Uint8Array(f.data), {
    headers: {
      "Content-Type": f.meta.contentType,
      "Content-Length": String(f.data.length),
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(f.meta.fileName)}`,
    },
  });
});
