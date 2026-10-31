"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Modal } from "./Modal";
import { DownloadIcon } from "./icons";
import { TypeTag } from "./ui";
import { byYearThenSaved, DESIGN_ROW, DESIGN_TABLE, DESIGN_THEAD, NARROW, SortTh, useSort } from "./admin/sort";

export interface ExampleRow {
  id: string;
  schoolYear: string;
  type: "subject" | "activity";
  grade: number;
  semester: number;
  name: string;
  fileName: string;
  size: number;
  /** 올린 때 (기본 순서에만 쓰고 학교 화면에는 표시하지 않음) */
  uploadedAt?: string;
}

export const fileSize = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`);

/** 첫 화면: '학교자율시간 예시안 보기' 버튼 → 예시안 목록 팝업 (로그인 없이 누구나 내려받기) */
export function ExamplesButton({ className = "mt-3 block" }: { className?: string }) {
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
      <button type="button" onClick={show} className={`${className} text-sm font-semibold text-brand-700 underline hover:text-brand-600`}>
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
              <ExamplesTable rows={rows} />
            </div>
          )}
        </Modal>
      )}
    </>
  );
}

/** 예시안 목록 표: 제목을 눌러 정렬, 기본은 학년도↓ → 올린 날↓ */
function ExamplesTable({ rows }: { rows: ExampleRow[] }) {
  const sort = useSort(
    rows,
    {
      year: (r) => r.schoolYear,
      type: (r) => r.type,
      grade: (r) => r.grade * 10 + r.semester,
      semester: (r) => r.semester * 10 + r.grade,
      name: (r) => r.name,
    },
    (a, b) => byYearThenSaved({ schoolYear: a.schoolYear, updatedAt: a.uploadedAt ?? "" }, { schoolYear: b.schoolYear, updatedAt: b.uploadedAt ?? "" }),
  );
  return (
    <table className={`${DESIGN_TABLE} [&_td]:px-2.5 [&_th]:px-2.5`}>
      <thead className={`sticky top-0 ${DESIGN_THEAD}`}>
        <tr>
          <SortTh label="학년도" k="year" sort={sort} dark className={NARROW} />
          <SortTh label="유형" k="type" sort={sort} dark className={NARROW} />
          <SortTh label="학년" k="grade" sort={sort} dark className={NARROW} />
          <SortTh label="학기" k="semester" sort={sort} dark className={NARROW} />
          <SortTh label="과목(활동)명" k="name" sort={sort} dark className="text-center" />
          <th className={`p-2 ${NARROW}`}>내려받기</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100 text-center">
        {sort.sorted.map((r) => (
          <tr key={r.id} className={DESIGN_ROW}>
            <td className="p-2">{r.schoolYear}</td>
            <td className="p-2">
              <TypeTag type={r.type} />
            </td>
            <td className="p-2">{r.grade}학년</td>
            <td className="p-2">{r.semester}학기</td>
            <td className="w-full max-w-0 p-2 text-left font-semibold">
              <span className="block truncate" title={r.name}>
                {r.name}
              </span>
            </td>
            <td className="p-2">
              <a
                href={`/api/examples/${r.id}`}
                title={`${r.fileName} (${fileSize(r.size)})`}
                className="inline-flex items-center gap-1 rounded-lg border border-brand-500 bg-white px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50"
              >
                {r.fileName.split(".").pop()?.toUpperCase()} <DownloadIcon className="h-3.5 w-3.5" />
              </a>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
