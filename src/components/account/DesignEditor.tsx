"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { DesignDoc } from "@/domain/types";
import { api, sendLog } from "@/lib/api";
import { DRAFT_KEY, Wizard } from "../wizard/Wizard";
import { Card } from "../ui";
import { useMe } from "../useMe";

interface SaveResponse {
  record: { id: string };
  duplicate: { id: string; name: string; schoolName: string; schoolYear: string } | null;
}

function warnDuplicate(r: SaveResponse) {
  if (r.duplicate) {
    alert(
      `저장했습니다. 다만 ${r.duplicate.schoolName}에 ${r.duplicate.schoolYear}학년도 같은 활동명 「${r.duplicate.name}」이(가) 이미 있습니다.\n` +
        "같은 학교의 같은 학년도에는 같은 활동명을 쓸 수 없어요. (예: 이름 뒤에 학년 숫자를 붙여 구분)",
    );
  }
}

/** 새 설계: 로그인했으면 저장 버튼이 생기고, 저장하면 /designs/[id]로 이동 */
export function NewDesign() {
  const me = useMe();
  const router = useRouter();
  const loggedIn = !!me?.user;
  return (
    <div className="space-y-3">
      {me?.enabled && !me.user && (
        <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
          로그인하면 설계를 저장하고 나중에 이어서 쓸 수 있어요. 로그인하지 않아도 이 브라우저에 임시로 보관되고, 문서는 내려받을 수 있어요.
        </p>
      )}
      <Wizard
        defaultSchoolName={me?.user?.schoolName}
        onSave={
          loggedIn
            ? async (doc: DesignDoc) => {
                const r = await api<SaveResponse>("/api/designs", { method: "POST", body: { doc } });
                warnDuplicate(r);
                try {
                  localStorage.removeItem(DRAFT_KEY);
                } catch {
                  /* 무시 */
                }
                router.replace(`/designs/${r.record.id}`);
              }
            : undefined
        }
        onParseFail={(step, error) => sendLog("parse_fail", `${step}: ${error}`)}
        onDownloaded={() => sendLog("download")}
      />
    </div>
  );
}

/** 저장된 설계 열기 */
export function EditDesign({ id }: { id: string }) {
  const [state, setState] = useState<{ doc?: DesignDoc; mine?: boolean; error?: string }>({});
  useEffect(() => {
    api<{ design: { doc: DesignDoc }; mine: boolean }>(`/api/designs/${id}`)
      .then((r) => setState({ doc: r.design.doc, mine: r.mine }))
      .catch((e) => setState({ error: e.message }));
  }, [id]);

  if (state.error) return <Card><p className="text-red-700">{state.error}</p></Card>;
  if (!state.doc) return <p className="text-gray-500">불러오는 중…</p>;
  return (
    <Wizard
      initial={state.doc}
      onSave={
        state.mine
          ? async (doc) => {
              warnDuplicate(await api<SaveResponse>(`/api/designs/${id}`, { method: "PUT", body: { doc } }));
            }
          : undefined
      }
      onParseFail={(step, error) => sendLog("parse_fail", `${step}: ${error}`, id)}
      onDownloaded={() => sendLog("download", undefined, id)}
    />
  );
}
