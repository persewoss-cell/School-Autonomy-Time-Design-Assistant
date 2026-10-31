"use client";

/** 화면에서 서버 API를 부를 때 쓰는 도우미. 실패하면 서버가 준 한국어 오류 문구로 예외를 던진다. */
export async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
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
