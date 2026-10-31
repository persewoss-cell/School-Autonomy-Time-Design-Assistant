"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { DesignDoc } from "@/domain/types";
import { api } from "@/lib/api";
import { Modal } from "./Modal";
import { DownloadIcon, OpenNewIcon } from "./icons";
import { TypeTag, inputClass } from "./ui";
import { loadMe } from "./useMe";
import { MultiSelect, SingleSelect } from "./admin/MultiSelect";
import { SortTh, useSort } from "./admin/sort";
import { saveDesignDocx } from "./wizard/downloadDesign";

interface Shared {
  id: string;
  school: string;
  type: "subject" | "activity";
  grade: number;
  semester: number;
  name: string;
  schoolYear: string;
}

const nextSchoolYear = () => {
  const now = new Date();
  return (now.getMonth() >= 2 ? now.getFullYear() : now.getFullYear() - 1) + 1;
};

/**
 * 첫 화면 '타학교 완성 설계안': 다른 학교가 완성한 설계(오류 0 + 체크리스트 모두 ○)를 보고·내려받고·우리 학교로 가져온다.
 * 로그인한 학교만 볼 수 있다. 시수 점검은 학교마다 하는 일이라 보지 않는다.
 */
export function SharedDesignsButton({ className }: { className: string }) {
  const [open, setOpen] = useState<"login" | "list" | null>(null);
  const [rows, setRows] = useState<Shared[] | null>(null);
  const [error, setError] = useState("");
  const show = async () => {
    const me = await loadMe();
    if (!me.user) return setOpen("login");
    setOpen("list");
    api<{ designs: Shared[] }>("/api/shared/designs")
      .then((r) => setRows(r.designs))
      .catch((e) => setError(e instanceof Error ? e.message : "불러오지 못했어요."));
  };
  return (
    <>
      <button type="button" onClick={() => void show()} className={className}>
        타학교 완성 설계안
      </button>
      {open === "login" && (
        <Modal
          title="로그인이 필요해요"
          onClose={() => setOpen(null)}
          actions={
            <Link href="/login" className="rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white hover:bg-brand-700">
              로그인
            </Link>
          }
        >
          <p>다른 학교가 완성한 설계안은 로그인한 학교만 볼 수 있어요.</p>
        </Modal>
      )}
      {open === "list" && (
        <Modal
          wide
          tone="brand"
          title="타학교 완성 설계안"
          onClose={() => setOpen(null)}
          actions={
            <button type="button" onClick={() => setOpen(null)} className="rounded-lg border border-gray-300 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50">
              닫기
            </button>
          }
        >
          {error ? <p className="text-red-700">{error}</p> : rows === null ? <p className="text-gray-500">불러오는 중…</p> : <SharedTable rows={rows} />}
        </Modal>
      )}
    </>
  );
}

function SharedTable({ rows }: { rows: Shared[] }) {
  const [q, setQ] = useState("");
  const [schools, setSchools] = useState<string[]>([]);
  const [type, setType] = useState("");
  const [grades, setGrades] = useState<string[]>([]);
  const [busy, setBusy] = useState("");
  const [cloned, setCloned] = useState<{ name: string; id: string } | null>(null);
  const shown = useMemo(
    () =>
      rows.filter(
        (d) =>
          (schools.length === 0 || schools.includes(d.school)) &&
          (!type || d.type === type) &&
          (grades.length === 0 || grades.includes(String(d.grade))) &&
          (!q || `${d.name} ${d.school}`.toLowerCase().includes(q.toLowerCase())),
      ),
    [rows, schools, type, grades, q],
  );
  const sort = useSort(shown, { school: (d) => d.school, type: (d) => d.type, grade: (d) => d.grade * 10 + d.semester, name: (d) => d.name });
  const fetchDoc = async (id: string) => (await api<{ doc: DesignDoc; school: string }>(`/api/shared/designs/${id}`)).doc;

  const download = async (d: Shared) => {
    setBusy(d.id);
    try {
      await saveDesignDocx(await fetchDoc(d.id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "내려받지 못했어요.");
    } finally {
      setBusy("");
    }
  };
  const clone = async (d: Shared) => {
    const answer = prompt(`${d.school}의 「${d.name}」을(를) 우리 학교 몇 학년도 설계로 가져올까요?`, String(nextSchoolYear()));
    if (answer === null) return;
    const year = answer.trim();
    if (!/^\d{4}$/.test(year)) return alert("학년도는 2027처럼 네 자리 숫자로 적어 주세요.");
    setBusy(d.id);
    try {
      const doc = structuredClone(await fetchDoc(d.id));
      // 우리 학교 설계로: 학년도·학교명은 바꾸고, 체크리스트·진행 위치·무시한 점검은 처음부터
      doc.application.startYear = year;
      doc.application.schoolName = "";
      doc.checklist = {};
      doc.dismissed = [];
      delete doc.progress;
      const r = await api<{ record: { id: string } }>("/api/designs", { method: "POST", body: { doc } });
      setCloned({ name: doc.basic.name, id: r.record.id });
    } catch (e) {
      alert(e instanceof Error ? e.message : "가져오지 못했어요.");
    } finally {
      setBusy("");
    }
  };

  const schoolOptions = [...new Set(rows.map((d) => d.school))].sort((a, b) => a.localeCompare(b, "ko")).map((v) => ({ value: v, label: v }));
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">다른 학교가 완성한 설계예요. 보기·내려받기를 하거나, 복제해 우리 학교 설계로 가져와 고쳐 쓸 수 있어요.</p>
      <div className="flex flex-wrap items-center gap-2">
        <input className={`${inputClass} max-w-48 !py-2 text-sm`} placeholder="이름·학교 검색" value={q} onChange={(e) => setQ(e.target.value)} />
        <MultiSelect allLabel="전체 학교" options={schoolOptions} selected={schools} onChange={setSchools} />
        <SingleSelect
          allLabel="전체 유형"
          options={[
            { value: "activity", label: "활동" },
            { value: "subject", label: "과목" },
          ]}
          value={type}
          onChange={setType}
        />
        <MultiSelect allLabel="전체 학년" options={[3, 4, 5, 6].map((g) => ({ value: String(g), label: `${g}학년` }))} selected={grades} onChange={setGrades} />
        <span className="text-sm text-gray-500">{shown.length}건</span>
      </div>
      <div className="max-h-[50vh] overflow-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="sticky top-0 bg-white text-left text-xs text-gray-500">
            <tr>
              <SortTh label="학교" k="school" sort={sort} />
              <SortTh label="유형" k="type" sort={sort} />
              <SortTh label="학년-학기" k="grade" sort={sort} />
              <SortTh label="명칭" k="name" sort={sort} />
              <th className="p-2 text-center">복제</th>
              <th className="p-2 text-center">보기</th>
              <th className="p-2 text-center">내려받기</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sort.sorted.map((d) => (
              <tr key={d.id}>
                <td className="p-2 font-semibold">{d.school}</td>
                <td className="p-2">
                  <TypeTag type={d.type} />
                </td>
                <td className="p-2 whitespace-nowrap">
                  {d.grade}-{d.semester}
                </td>
                <td className="p-2">
                  {d.name}
                  <span className="ml-1 text-xs text-gray-400">({d.schoolYear})</span>
                </td>
                <td className="p-2 text-center">
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => void clone(d)}
                    className="rounded-full border border-brand-100 bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700 hover:bg-brand-100 disabled:opacity-50"
                  >
                    복제
                  </button>
                </td>
                <td className="p-2 text-center">
                  <a href={`/shared/${d.id}`} target="_blank" rel="noopener noreferrer" title="새 창에서 문서 보기" className="inline-flex rounded-lg p-1.5 text-gray-600 hover:bg-gray-100">
                    <OpenNewIcon />
                  </a>
                </td>
                <td className="p-2 text-center">
                  <button type="button" disabled={!!busy} onClick={() => void download(d)} title="문서(.docx) 내려받기" className="inline-flex rounded-lg p-1.5 text-brand-700 hover:bg-brand-50 disabled:opacity-50">
                    {busy === d.id ? "…" : <DownloadIcon />}
                  </button>
                </td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-gray-500">
                  {rows.length === 0 ? "아직 다른 학교가 완성한 설계가 없어요." : "조건에 맞는 설계가 없어요."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {cloned && (
        <Modal
          tone="amber"
          title="우리 학교에 맞게 고쳐 써 주세요"
          onClose={() => setCloned(null)}
          actions={
            <>
              <button type="button" onClick={() => setCloned(null)} className="rounded-lg border border-gray-300 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50">
                계속 둘러보기
              </button>
              <Link href={`/designs/${cloned.id}`} className="rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white hover:bg-brand-700">
                가져온 설계 열기
              </Link>
            </>
          }
        >
          <p>
            「{cloned.name}」을(를) 우리 학교 설계 현황으로 가져왔어요.
          </p>
          <p className="text-sm">
            다른 학교의 교육과정이라 <b>그대로 쓰면 안 돼요.</b> 학년·학기·운영 시수, 학교·지역 여건, 단원 지도계획, 평가 계획, 계획서(학교명 등)를 우리 학교에 맞게 고치고, 체크리스트를 다시 확인해 주세요.
          </p>
        </Modal>
      )}
    </div>
  );
}
