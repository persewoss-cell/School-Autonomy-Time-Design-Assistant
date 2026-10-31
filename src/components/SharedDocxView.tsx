"use client";

import { useEffect, useRef, useState } from "react";
import { Packer } from "docx";
import type { DesignDoc } from "@/domain/types";
import { buildDesignDocx } from "@/export/docx";
import { api } from "@/lib/api";
import { DownloadIcon } from "./icons";
import { Card } from "./ui";
import { saveDesignDocx } from "./wizard/downloadDesign";

/** 새 창: 내려받은 것과 같은 .docx 파일을 그대로 화면에 띄움 (읽기 전용) */
export function SharedDocxView({ id }: { id: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<DesignDoc | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    (async () => {
      const { doc } = await api<{ doc: DesignDoc }>(`/api/shared/designs/${id}`);
      if (!alive) return;
      setDoc(doc);
      const blob = await Packer.toBlob(buildDesignDocx(doc));
      const { renderAsync } = await import("docx-preview");
      if (alive && box.current) await renderAsync(blob, box.current, undefined, { inWrapper: true, ignoreLastRenderedPageBreak: false });
    })().catch((e) => alive && setError(e instanceof Error ? e.message : "문서를 열지 못했어요."));
    return () => {
      alive = false;
    };
  }, [id]);
  return (
    <div className="space-y-3">
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-gray-500">내려받은 문서(.docx) 그대로 보기</p>
          <h1 className="text-xl font-bold">{doc?.basic.name ?? "문서 여는 중…"}</h1>
        </div>
        {doc && (
          <button type="button" onClick={() => void saveDesignDocx(doc)} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white hover:bg-brand-700">
            다시 내려받기 <DownloadIcon />
          </button>
        )}
      </Card>
      {error && <p className="text-red-700">{error}</p>}
      <div ref={box} className="overflow-x-auto rounded-xl" />
    </div>
  );
}
