import { getRepo, handle, json } from "@/server/context";
import { listExamples } from "@/server/services";

export const dynamic = "force-dynamic";

/** 예시안 목록 (로그인 없이 누구나) */
export const GET = handle(async () => json({ examples: await listExamples(await getRepo()) }));
