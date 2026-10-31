"use client";

import { useEffect, useState } from "react";
import type { DesignDoc } from "@/domain/types";
import { api } from "@/lib/api";
import { DownloadIcon } from "./icons";
import { Card, TypeTag } from "./ui";
import { DocPreview } from "./wizard/FinalSteps";
import { saveDesignDocx } from "./wizard/downloadDesign";

/** 새 창: 타학교 완성 설계 문서 보기 (읽기 전용) */
export function SharedDesignView({ id }: { id: string }) {
  const [data, setData] = useState<{ doc: DesignDoc; school: string } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api<{ doc: DesignDoc; school: string }>(`/api/shared/designs/${id}`)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "불러오지 못했어요."));
  }, [id]);
  if (error) return <Card><p className="text-red-700">{error}</p></Card>;
  if (!data) return <p className="text-gray-500">불러오는 중…</p>;
  const { doc, school } = data;
  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-sm text-gray-500">
            {school} · <TypeTag type={doc.basic.type} /> {doc.basic.grade}학년 {doc.basic.semester}학기 · {doc.basic.hours}차시 · {doc.application.startYear}학년도
          </p>
          <h1 className="text-2xl font-bold">{doc.basic.name}</h1>
        </div>
        <button type="button" onClick={() => void saveDesignDocx(doc)} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white hover:bg-brand-700">
          문서 내려받기 <DownloadIcon />
        </button>
      </Card>
      <DocPreview doc={doc} title="문서 미리보기" />
    </div>
  );
}
