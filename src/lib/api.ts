"use client";

/**
 * 같은 화면의 여러 부분이 같은 목록을 동시에 부르는 일이 많아서(설계 목록·시수 점검 등),
 * GET은 3초 동안 한 번만 서버에 묻고 결과를 나눠 쓴다. 저장·삭제 같은 요청을 하면 바로 비운다.
 */
const GET_TTL = 3000;
const getCache = new Map<string, { at: number; p: Promise<unknown> }>();
export const clearApiCache = () => getCache.clear();

/** 화면에서 서버 API를 부를 때 쓰는 도우미. 실패하면 서버가 준 한국어 오류 문구로 예외를 던진다. */
export async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const method = init?.method ?? "GET";
  if (method !== "GET") {
    clearApiCache();
    return request<T>(path, init);
  }
  const hit = getCache.get(path);
  if (hit && Date.now() - hit.at < GET_TTL) return structuredClone((await hit.p) as T);
  const p = request<T>(path, init);
  getCache.set(path, { at: Date.now(), p });
  p.catch(() => getCache.delete(path));
  return structuredClone(await p);
}

async function request<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(path, {
    method: init?.method ?? "GET",
    headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? "요청을 처리하지 못했습니다.");
  return data as T;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface Me {
  enabled: boolean;
  user: { id: string; region: string; schoolName: string; role: "teacher" | "admin"; status: string; mustChangePassword: boolean } | null;
  /** 관리자가 이 학교로 들어가 보는 중 */
  acting?: { adminSchool: string } | null;
}

/** 이용 기록 보내기 (실패해도 무시) */
export function sendLog(kind: "download" | "parse_fail", detail?: string, designId?: string) {
  void fetch("/api/logs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, detail, designId }),
  }).catch(() => {});
}
