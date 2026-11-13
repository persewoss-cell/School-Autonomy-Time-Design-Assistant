"use client";

import { useEffect } from "react";
import { countStat } from "@/lib/api";

/** 방문자 세기: 이 브라우저에서 오늘 처음 들어왔을 때만 한 번 (한국 시간 날짜). 개인정보는 보내지 않는다 */
export function VisitPing() {
  useEffect(() => {
    const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
    try {
      if (localStorage.getItem("sat-visit-day") === today) return;
      localStorage.setItem("sat-visit-day", today);
    } catch {
      /* 저장 공간을 못 쓰는 브라우저도 한 번은 셈 */
    }
    countStat("visit");
  }, []);
  return null;
}
