"use client";

import { useEffect, useRef, useState } from "react";
import type { DesignDoc } from "@/domain/types";
import { api, sendLog } from "@/lib/api";
import { Wizard } from "../wizard/Wizard";
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

/** 새 설계: 로그인했으면 단계를 넘길 때 자동으로 서버에 저장되고, 첫 저장 뒤 주소가 /designs/[id]로 바뀜 */
export function NewDesign() {
  const me = useMe();
  const loggedIn = !!me?.user;
  const [designId, setDesignId] = useState<string>();
  const idRef = useRef<string | undefined>(undefined);
  const creating = useRef<Promise<SaveResponse> | null>(null);
  const warned = useRef(false);

  const save = async (doc: DesignDoc, { auto }: { auto: boolean }) => {
    if (!doc.basic.name.trim() && auto) return; // 이름을 정하기 전(유형 선택 단계)에는 서버에 만들지 않음
    let r: SaveResponse;
    if (!idRef.current && !creating.current) {
      // 처음 저장: 서버에 새로 만들기 (동시에 여러 번 불려도 한 번만 만듦)
      creating.current = api<SaveResponse>("/api/designs", { method: "POST", body: { doc } });
      r = await creating.current;
      idRef.current = r.record.id;
      setDesignId(r.record.id);
      window.history.replaceState(null, "", `/designs/${r.record.id}`);
    } else {
      if (!idRef.current) await creating.current;
      r = await api<SaveResponse>(`/api/designs/${idRef.current}`, { method: "PUT", body: { doc } });
    }
    if (r.duplicate && (!auto || !warned.current)) {
      warned.current = true;
      warnDuplicate(r);
    }
  };

  return (
    <div className="space-y-3">
      {me?.enabled && !me.user && (
        <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
          로그인하면 설계가 서버에 자동 저장되어 다른 컴퓨터에서도 이어서 쓸 수 있어요. 로그인하지 않아도 이 브라우저에 임시로 보관되고, 문서는 내려받을 수 있어요.
        </p>
      )}
      <Wizard
        designId={designId}
        defaultSchoolName={me?.user?.schoolName}
        onSave={loggedIn ? save : undefined}
        onParseFail={(step, error) => sendLog("parse_fail", `${step}: ${error}`, designId)}
        onDownloaded={() => sendLog("download", undefined, designId)}
      />
    </div>
  );
}

/** 저장된 설계 열기: 마지막으로 작성하던 단계부터 */
export function EditDesign({ id }: { id: string }) {
  const [state, setState] = useState<{ doc?: DesignDoc; mine?: boolean; updatedAt?: string; error?: string }>({});
  const warned = useRef(false);
  useEffect(() => {
    api<{ design: { doc: DesignDoc; updatedAt: string }; mine: boolean }>(`/api/designs/${id}`)
      .then((r) => setState({ doc: r.design.doc, mine: r.mine, updatedAt: r.design.updatedAt }))
      .catch((e) => setState({ error: e.message }));
  }, [id]);

  if (state.error) return <Card><p className="text-red-700">{state.error}</p></Card>;
  if (!state.doc) return <p className="text-gray-500">불러오는 중…</p>;
  return (
    <Wizard
      initial={state.doc}
      designId={id}
      onSave={
        state.mine
          ? async (doc, { auto }) => {
              const r = await api<SaveResponse>(`/api/designs/${id}`, { method: "PUT", body: { doc } });
              if (r.duplicate && (!auto || !warned.current)) {
                warned.current = true;
                warnDuplicate(r);
              }
            }
          : undefined
      }
      onParseFail={(step, error) => sendLog("parse_fail", `${step}: ${error}`, id)}
      onDownloaded={() => sendLog("download", undefined, id)}
    />
  );
}
