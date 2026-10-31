"use client";

import { useCallback, useEffect, useState } from "react";
import { api, clearApiCache } from "@/lib/api";
import { checkKey, isViewGrade, type Checks, type DesignBrief, type HourCheck } from "@/domain/hoursView";
import { useMe } from "../useMe";

const LOCAL_KEY = "sat-hours-v3";

function readLocal(): Checks {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? "{}") as Checks;
  } catch {
    return {};
  }
}

/**
 * 우리 학교 시수 점검 저장본 + 설계 현황.
 * 로그인했으면 학교 계정(서버)에, 아니면 이 브라우저에 저장한다.
 */
export function useHourChecks() {
  const me = useMe();
  const loggedIn = !!me?.user;
  const [checks, setChecks] = useState<Checks>({});
  const [designs, setDesigns] = useState<DesignBrief[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!me) return;
    if (!me.user) {
      setChecks(readLocal());
      setLoaded(true);
      return;
    }
    Promise.all([
      api<{ checks: { grade: number; data: HourCheck }[] }>("/api/hours"),
      api<{ designs: DesignBrief[] }>("/api/designs"),
    ])
      .then(([h, d]) => {
        const map: Checks = {};
        for (const c of h.checks) if (isViewGrade(c.grade) && c.data?.schoolYear) map[checkKey(c.data.schoolYear, c.grade)] = c.data;
        setChecks(map);
        setDesigns(d.designs);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [me]);

  /** keepalive: 페이지를 떠나는 중에도 저장 요청이 끝까지 가도록 */
  const save = useCallback(
    async (check: HourCheck, opts: { keepalive?: boolean } = {}) => {
      const stamped = { ...check, updatedAt: new Date().toISOString() };
      setChecks((c) => {
        const next = { ...c, [checkKey(check.schoolYear, check.grade)]: stamped };
        if (!loggedIn) {
          try {
            localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
          } catch {
            /* 저장 못 해도 화면은 동작 */
          }
        }
        return next;
      });
      if (!loggedIn) return;
      if (opts.keepalive) {
        clearApiCache();
        void fetch(`/api/hours/${check.grade}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ check: stamped }),
          keepalive: true,
        });
        return;
      }
      await api(`/api/hours/${check.grade}`, { method: "PUT", body: { check: stamped } });
    },
    [loggedIn],
  );

  return { me, loggedIn, checks, designs, loaded, save };
}
