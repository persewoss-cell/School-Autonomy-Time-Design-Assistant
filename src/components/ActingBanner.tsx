"use client";

import { api } from "@/lib/api";
import { useMe } from "./useMe";

/** 관리자가 다른 학교로 들어가 보는 중일 때 맨 위 빨간 띠 */
export function ActingBanner() {
  const me = useMe();
  if (!me?.acting || !me.user) return null;
  const back = async () => {
    await api("/api/admin/act", { method: "DELETE" }).catch(() => {});
    window.location.href = "/admin/designs";
  };
  return (
    <div className="bg-red-600 text-sm text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-1.5">
        <span>
          관리자 모드: <b>{me.user.schoolName}</b> 화면을 그 학교가 보는 그대로 보는 중이에요. 고치면 그 학교 설계가 바뀌고 이용 기록에 남아요.
        </span>
        <button type="button" onClick={() => void back()} className="rounded-md bg-white px-3 py-0.5 font-semibold text-red-700 hover:bg-red-50">
          ← 목록으로 돌아가기
        </button>
      </div>
    </div>
  );
}

/** 관리자: 그 학교로 들어가 href를 연다 */
export async function enterSchool(userId: string, href: string) {
  await api("/api/admin/act", { method: "POST", body: { userId } });
  window.location.href = href;
}
