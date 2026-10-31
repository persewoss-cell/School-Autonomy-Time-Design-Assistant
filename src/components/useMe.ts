"use client";

import { useEffect, useState } from "react";
import { api, type Me } from "@/lib/api";

// 한 화면에서 여러 부분(메뉴·버튼·띠 등)이 함께 쓰므로 페이지당 한 번만 서버에 묻는다.
// 로그인·로그아웃·학교 화면 들어가기는 모두 페이지를 새로 열어서 그때 다시 묻는다.
let mePromise: Promise<Me> | null = null;
let meValue: Me | null = null;

/** 현재 로그인 상태 (null = 확인 중) */
export function useMe(): Me | null {
  const [me, setMe] = useState<Me | null>(meValue);
  useEffect(() => {
    if (meValue) return;
    mePromise ??= api<Me>("/api/auth/me").catch(() => ({ enabled: false, user: null }));
    let alive = true;
    void mePromise.then((m) => {
      meValue = m;
      if (alive) setMe(m);
    });
    return () => {
      alive = false;
    };
  }, []);
  return me;
}
