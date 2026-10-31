"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Modal } from "./Modal";
import { DownloadIcon } from "./icons";
import { TypeTag } from "./ui";

export interface ExampleRow {
  id: string;
  schoolYear: string;
  type: "subject" | "activity";
  grade: number;
  semester: number;
  name: string;
  fileName: string;
  size: number;
}

export const fileSize = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`);

/** 첫 화면: '학교자율시간 예시안 보기' 버튼 → 예시안 목록 팝업 (로그인 없이 누구나 내려받기) */
export function ExamplesButton() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ExampleRow[] | null>(null);
  const [error, setError] = useState("");
  const show = () => {
    setOpen(true);
    api<{ examples: ExampleRow[] }>("/api/examples")
      .then((r) => setRows(r.examples))
      .catch((e) => setError(e instanceof Error ? e.message : "불러오지 못했어요."));
  };
  return (
    <>
      <button type="button" onClick={show} className="mt-3 block text-sm font-semibold text-brand-700 underline hover:text-brand-600">
        학교자율시간 예시안 보기 (광양중동초등학교)
      </button>
      {open && (
        <Modal
          wide
          tone="brand"
          title="학교자율시간 예시안"
          onClose={() => setOpen(false)}
          actions={
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-gray-300 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50">
              닫기
            </button>
          }
        >
          {error ? (
            <p className="text-red-700">{error}</p>
          ) : rows === null ? (
            <p className="text-gray-500">불러오는 중…</p>
          ) : rows.length === 0 ? (
            <p className="text-gray-600">아직 올라온 예시안이 없어요.</p>
          ) : (
            <div className="max-h-[60vh] overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-gray-500">
                  <tr>
                    <th className="p-2">학년도</th>
                    <th className="p-2">활동/과목</th>
                    <th className="p-2">학년·학기</th>
                    <th className="p-2">이름</th>
                    <th className="p-2 text-center">내려받기</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="p-2 whitespace-nowrap">{r.schoolYear}</td>
                      <td className="p-2">
                        <TypeTag type={r.type} />
                      </td>
                      <td className="p-2 whitespace-nowrap">
                        {r.grade}학년 {r.semester}학기
                      </td>
                      <td className="p-2 font-semibold">{r.name}</td>
                      <td className="p-2 text-center">
                        <a
                          href={`/api/examples/${r.id}`}
                          title={`${r.fileName} (${fileSize(r.size)})`}
                          className="inline-flex items-center gap-1 rounded-lg border border-brand-500 px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50"
                        >
                          {r.fileName.split(".").pop()?.toUpperCase()} <DownloadIcon className="h-3.5 w-3.5" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
