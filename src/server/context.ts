import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { env, isAccountEnabled } from "@/lib/env";
import { mongoRepo } from "./mongoRepo";
import { memoryRepo, type Repo, type User } from "./repo";
import { ServiceError } from "./services";
import { SESSION_COOKIE, SESSION_DAYS, createSessionToken, readSessionToken } from "./session";

/** API에서 쓰는 공통 도우미: 저장소, 현재 사용자, 오류 응답 */

export async function getRepo(): Promise<Repo> {
  if (!isAccountEnabled()) {
    throw new ServiceError(503, "저장·로그인 기능이 아직 설정되지 않았습니다. (관리자: MONGODB_URI, AUTH_SECRET 환경 변수 필요)");
  }
  // 시험용: MONGODB_URI=memory 이면 메모리에 저장 (서버를 다시 켜면 사라짐)
  if (env.mongodbUri === "memory") {
    const g = globalThis as unknown as { _memRepo?: Repo };
    return (g._memRepo ??= memoryRepo());
  }
  return mongoRepo(await getDb());
}

export async function currentUser(repo: Repo): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const id = await readSessionToken(token, env.authSecret);
  if (!id) return null;
  const user = await repo.users.findById(id);
  return user && user.status === "active" ? user : null;
}

export async function requireUser(repo: Repo): Promise<User> {
  const u = await currentUser(repo);
  if (!u) throw new ServiceError(401, "로그인이 필요합니다.");
  return u;
}

export async function requireAdmin(repo: Repo): Promise<User> {
  const u = await requireUser(repo);
  if (u.role !== "admin") throw new ServiceError(403, "관리자만 볼 수 있습니다.");
  return u;
}

export async function setSession(userId: string) {
  (await cookies()).set(SESSION_COOKIE, await createSessionToken(userId, env.authSecret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 3600,
  });
}

export async function clearSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** 라우트 처리기를 감싸 ServiceError를 알기 쉬운 JSON 오류로 바꾼다 */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof ServiceError) return NextResponse.json({ error: e.message }, { status: e.status });
      console.error(e);
      return NextResponse.json({ error: "서버 오류가 났습니다. 잠시 뒤 다시 시도해 주세요." }, { status: 500 });
    }
  };
}

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });
