import { NextResponse } from "next/server";
import { getDb, isDbConfigured } from "@/lib/db";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/** 설정 확인용 (비밀 값 자체는 절대 돌려주지 않음) */
export async function GET() {
  let db: "not_configured" | "ok" | "error" | "memory" = "not_configured";
  let dbError: string | undefined;
  if (env.mongodbUri === "memory") db = "memory";
  else if (isDbConfigured()) {
    try {
      await (await getDb()).command({ ping: 1 });
      db = "ok";
    } catch (e) {
      db = "error";
      dbError = e instanceof Error ? e.message.slice(0, 200) : "unknown";
    }
  }
  return NextResponse.json({
    db,
    dbError,
    authSecret: env.authSecret.length >= 32 ? "ok" : env.authSecret ? "short" : "missing",
    adminSchools: env.adminSchools.length,
  });
}
