import { SignJWT, jwtVerify } from "jose";

/** 로그인 세션: 서명한 토큰을 httpOnly 쿠키에 넣는다. 비밀키는 환경 변수 AUTH_SECRET. */

export const SESSION_COOKIE = "sat_session";
export const SESSION_DAYS = 7;

const key = (secret: string) => new TextEncoder().encode(secret);

export async function createSessionToken(userId: string, secret: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(key(secret));
}

export async function readSessionToken(token: string | undefined, secret: string): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(secret), { algorithms: ["HS256"] });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}
