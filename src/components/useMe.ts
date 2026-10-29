"use client";

import { useEffect, useState } from "react";
import { api, type Me } from "@/lib/api";

/** 현재 로그인 상태 (null = 확인 중) */
export function useMe(): Me | null {
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    api<Me>("/api/auth/me")
      .then(setMe)
      .catch(() => setMe({ enabled: false, user: null }));
  }, []);
  return me;
}
