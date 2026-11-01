"use client";

import { useMemo, useState } from "react";
import { Modal } from "./Modal";
import { inputClass } from "./ui";
import { MultiSelect } from "./admin/MultiSelect";
import { DESIGN_ROW, DESIGN_TABLE, DESIGN_THEAD, NARROW, SortTh, useSort } from "./admin/sort";

/** 2022 개정 교육과정 성취기준 한 줄 (data/curriculum/standards-2022.json, 사용자가 올린 엑셀을 그대로 옮김) */
interface CurriculumStandard {
  band: string;
  subject: string;
  area: string;
  code: string;
  text: string;
}

/** 엑셀 순서(교과·영역·코드 순) 그대로 쓰려고 원래 순번을 붙인다 */
type Row = CurriculumStandard & { order: number };

const bandOf = (grade: number) => (grade <= 4 ? "3~4학년군" : "5~6학년군");

/**
 * 성취기준 단계의 '2022 개정 교육과정 성취기준' 버튼 → 큰 팝업.
 * 검색·학년군·교과·영역으로 골라 본다. 처음엔 이 설계의 학년군·편성 교과로 골라 둔다.
 * 자료는 버튼을 누를 때 불러온다 (처음 화면 속도에 영향 없게).
 */
export function CurriculumStandardsButton({ grade, subjectGroup }: { grade: number; subjectGroup: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [open, setOpen] = useState(false);
  const show = async () => {
    setOpen(true);
    if (!rows) {
      const data = (await import("../../data/curriculum/standards-2022.json")).default as CurriculumStandard[];
      setRows(data.map((r, order) => ({ ...r, order })));
    }
  };
  return (
    <>
      <button type="button" onClick={() => void show()} className="shrink-0 rounded-lg border border-sky-600 bg-sky-50 px-3 py-1.5 text-sm font-semibold text-sky-700 hover:bg-sky-100">
        📘 2022 개정 교육과정 성취기준
      </button>
      {open && (
        <Modal
          xl
          tone="brand"
          title="2022 개정 교육과정 성취기준 (3~6학년)"
          onClose={() => setOpen(false)}
          actions={
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-gray-300 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50">
              닫기
            </button>
          }
        >
          {rows ? <StandardsTable rows={rows} grade={grade} subjectGroup={subjectGroup} /> : <p className="text-gray-500">불러오는 중…</p>}
        </Modal>
      )}
    </>
  );
}

function StandardsTable({ rows, grade, subjectGroup }: { rows: Row[]; grade: number; subjectGroup: string }) {
  const subjects = [...new Set(rows.map((r) => r.subject))];
  const [q, setQ] = useState("");
  const [bands, setBands] = useState<string[]>([bandOf(grade)]);
  const [subs, setSubs] = useState<string[]>(subjects.includes(subjectGroup) ? [subjectGroup] : []);
  const [areas, setAreas] = useState<string[]>([]);
  // 영역은 고른 학년군·교과 안에서만 보여 준다
  const areaOptions = [
    ...new Set(rows.filter((r) => (bands.length === 0 || bands.includes(r.band)) && (subs.length === 0 || subs.includes(r.subject))).map((r) => r.area)),
  ].map((v) => ({ value: v, label: v }));
  const shown = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return rows.filter(
      (r) =>
        (bands.length === 0 || bands.includes(r.band)) &&
        (subs.length === 0 || subs.includes(r.subject)) &&
        (areas.length === 0 || areas.includes(r.area)) &&
        words.every((w) => `${r.code} ${r.text} ${r.area} ${r.subject}`.toLowerCase().includes(w)),
    );
  }, [rows, bands, subs, areas, q]);
  const sort = useSort(
    shown,
    { band: (r) => r.band, subject: (r) => r.subject, area: (r) => r.area, code: (r) => r.code, text: (r) => r.text },
    (a, b) => a.order - b.order,
  );
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        학교자율시간 성취기준을 만들 때 참고하세요. 활동은 기존 교과 성취기준을 재구조화할 수 있지만 그대로 옮겨 쓰면 안 되고, 과목은 새로 개발해요.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input className={`${inputClass} max-w-56 !py-2 text-sm`} placeholder="코드·내용 검색 (예: 토의, 4국01)" value={q} onChange={(e) => setQ(e.target.value)} />
        <MultiSelect allLabel="전체 학년군" options={["3~4학년군", "5~6학년군"].map((v) => ({ value: v, label: v }))} selected={bands} onChange={setBands} />
        <MultiSelect
          allLabel="전체 교과"
          options={subjects.map((v) => ({ value: v, label: v }))}
          selected={subs}
          onChange={(v) => {
            setSubs(v);
            setAreas([]);
          }}
        />
        <MultiSelect allLabel="전체 영역" options={areaOptions} selected={areas} onChange={setAreas} />
        <span className="text-sm text-gray-500">{shown.length}개</span>
      </div>
      <div className="overflow-x-auto rounded-lg bg-white">
        <table className={`${DESIGN_TABLE} [&_td]:px-2.5 [&_th]:px-2.5`}>
          <thead className={`sticky top-0 ${DESIGN_THEAD}`}>
            <tr>
              <SortTh label="학년군" k="band" sort={sort} dark className={NARROW} />
              <SortTh label="교과" k="subject" sort={sort} dark className={NARROW} />
              <SortTh label="영역" k="area" sort={sort} dark className={NARROW} />
              <SortTh label="코드" k="code" sort={sort} dark className={NARROW} />
              <SortTh label="성취기준" k="text" sort={sort} dark className="text-center" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-center">
            {sort.sorted.map((r) => (
              <tr key={r.order} className={DESIGN_ROW}>
                <td className="p-2">{r.band}</td>
                <td className="p-2">{r.subject}</td>
                <td className="p-2">{r.area}</td>
                <td className="p-2 font-mono text-xs">{r.code}</td>
                {/* 성취기준 문장은 길어서 줄을 바꿔 다 보여 준다 */}
                <td className="w-full p-2 text-left whitespace-normal">{r.text}</td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={5} className="p-4 text-gray-500">
                  조건에 맞는 성취기준이 없어요.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
