import { NextResponse } from "next/server";
import { getDb, isDbConfigured } from "@/lib/db";
import { env, isDemoMode } from "@/lib/env";

export const dynamic = "force-dynamic";

/** 설정 확인용: DB 연결과 AI 키 설정 여부 (비밀 값 자체는 절대 돌려주지 않음) */
export async function GET() {
  let db: "not_configured" | "ok" | "error" = "not_configured";
  let dbError: string | undefined;
  if (isDbConfigured()) {
    try {
      await (await getDb()).command({ ping: 1 });
      db = "ok";
    } catch (e) {
      db = "error";
      dbError = e instanceof Error ? e.message.slice(0, 200) : "unknown";
    }
  }
  return NextResponse.json({
    ai: isDemoMode() ? "demo" : "configured",
    model: env.claudeModel,
    db,
    dbError,
  });
}
