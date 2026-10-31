"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { DesignDoc } from "@/domain/types";
import { api } from "@/lib/api";
import { Modal } from "./Modal";
import { DownloadIcon, OpenNewIcon } from "./icons";
import { TypeTag, inputClass } from "./ui";
import { loadMe } from "./useMe";
import { MultiSelect, SingleSelect } from "./admin/MultiSelect";
import { SortTh, useSort } from "./admin/sort";
import { saveDesignDocx } from "./wizard/downloadDesign";
import { ExamplesButton } from "./Examples";

interface Shared {
  id: string;
  school: string;
  type: "subject" | "activity";
  grade: number;
  semester: number;
  name: string;
  schoolYear: string;
  /** 본교 설계 */
  mine: boolean;
}

const nextSchoolYear = () => {
  const now = new Date();
  return (now.getMonth() >= 2 ? now.getFullYear() : now.getFullYear() - 1) + 1;
};

/**
 * 첫 화면 '타학교 완성 설계안' 버튼: 로그인했으면 /shared 화면으로, 아니면 로그인 안내.
 */
export function SharedDesignsButton({ className }: { className: string }) {
  const router = useRouter();
  const [login, setLogin] = useState(false);
  const show = async () => {
    const me = await loadMe();
    if (!me.user) return setLogin(true);
    router.push("/shared");
  };
  return (
    <>
      <button type="button" onClick={() => void show()} className={className}>
        타학교 완성 설계안
      </button>
      {login && <LoginNeeded onClose={() => setLogin(false)} />}
    </>
  );
}

function LoginNeeded({ onClose }: { onClose: () => void }) {
  return (
    <Modal
      title="로그인이 필요해요"
      onClose={onClose}
      actions={
        <Link href="/login?next=%2Fshared" className="rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white hover:bg-brand-700">
          로그인
        </Link>
      }
    >
      <p>학교들이 완성한 설계안은 로그인한 학교만 볼 수 있어요.</p>
    </Modal>
  );
}

/**
 * '타학교 완성 설계안' 화면: 완성한 설계(오류 0 + 체크리스트 모두 ○)를 보고·내려받고·우리 학교로 가져온다.
 * 본교 설계도 '본교' 표시로 함께 보인다. 시수 점검은 학교마다 하는 일이라 보지 않는다.
 */
export function SharedDesignsPage() {
  const [rows, setRows] = useState<Shared[] | null>(null);
  const [error, setError] = useState("");
  const [login, setLogin] = useState(false);
  useEffect(() => {
    void loadMe().then((me) => {
      if (!me.user) return setLogin(true);
      api<{ designs: Shared[] }>("/api/shared/designs")
        .then((r) => setRows(r.designs))
        .catch((e) => setError(e instanceof Error ? e.message : "불러오지 못했어요."));
    });
  }, []);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">타학교 완성 설계안</h1>
        <p className="mt-1 text-sm text-gray-600">학교들이 완성한 설계예요. 보기·내려받기를 하거나, 복제해 우리 학교 설계로 가져와 고쳐 쓸 수 있어요.</p>
      </div>
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        {login ? (
          <p className="text-gray-600">
            로그인한 학교만 볼 수 있어요.{" "}
            <Link href="/login?next=%2Fshared" className="font-semibold text-brand-700 underline">
              로그인
            </Link>
          </p>
        ) : error ? (
          <p className="text-red-700">{error}</p>
        ) : rows === null ? (
          <p className="text-gray-500">불러오는 중…</p>
        ) : (
          <SharedTable rows={rows} />
        )}
      </div>
    </div>
  );
}

function SharedTable({ rows }: { rows: Shared[] }) {
  const [q, setQ] = useState("");
  const [schools, setSchools] = useState<string[]>([]);
  const [type, setType] = useState("");
  const [grades, setGrades] = useState<string[]>([]);
  const [years, setYears] = useState<string[]>([]);
  const [busy, setBusy] = useState("");
  /** 보기·내려받기 전 양식 안내 */
  const [notice, setNotice] = useState<{ row: Shared; action: "view" | "download" } | null>(null);
  const [cloned, setCloned] = useState<{ name: string; id: string } | null>(null);
  const shown = useMemo(
    () =>
      rows.filter(
        (d) =>
          (schools.length === 0 || schools.includes(d.school)) &&
          (!type || d.type === type) &&
          (grades.length === 0 || grades.includes(String(d.grade))) &&
          (years.length === 0 || years.includes(d.schoolYear)) &&
          (!q || `${d.name} ${d.school}`.toLowerCase().includes(q.toLowerCase())),
      ),
    [rows, schools, type, grades, years, q],
  );
  const sort = useSort(shown, {
    year: (d) => d.schoolYear,
    school: (d) => d.school,
    type: (d) => d.type,
    grade: (d) => d.grade * 10 + d.semester,
    name: (d) => d.name,
  });
  const yearOptions = [...new Set(rows.map((d) => d.schoolYear))].sort().reverse().map((v) => ({ value: v, label: `${v}학년도` }));
  const proceed = () => {
    if (!notice) return;
    const { row, action } = notice;
    setNotice(null);
    if (action === "view") window.open(`/shared/${row.id}`, "_blank", "noopener,noreferrer");
    else void download(row);
  };
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
    const answer = prompt(`${d.mine ? "본교" : d.school}의 「${d.name}」을(를) 우리 학교 몇 학년도 설계로 가져올까요?`, String(nextSchoolYear()));
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
      <div className="flex flex-wrap items-center gap-2">
        <input className={`${inputClass} max-w-48 !py-2 text-sm`} placeholder="이름·학교 검색" value={q} onChange={(e) => setQ(e.target.value)} />
        <MultiSelect allLabel="전체 학년도" options={yearOptions} selected={years} onChange={setYears} />
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
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="sticky top-0 bg-white text-left text-xs text-gray-500">
            <tr>
              <SortTh label="학년도" k="year" sort={sort} />
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
                <td className="p-2 whitespace-nowrap">{d.schoolYear}</td>
                <td className="p-2 font-semibold">
                  {d.school}
                  {d.mine && <span className="ml-1 rounded-full bg-brand-600 px-2 py-0.5 text-xs font-semibold text-white">본교</span>}
                </td>
                <td className="p-2">
                  <TypeTag type={d.type} />
                </td>
                <td className="p-2 whitespace-nowrap">
                  {d.grade}-{d.semester}
                </td>
                <td className="p-2">{d.name}</td>
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
                  <button type="button" onClick={() => setNotice({ row: d, action: "view" })} title="새 창에서 문서 보기" className="inline-flex rounded-lg p-1.5 text-gray-600 hover:bg-gray-100">
                    <OpenNewIcon />
                  </button>
                </td>
                <td className="p-2 text-center">
                  <button type="button" disabled={!!busy} onClick={() => setNotice({ row: d, action: "download" })} title="문서(.docx) 내려받기" className="inline-flex rounded-lg p-1.5 text-brand-700 hover:bg-brand-50 disabled:opacity-50">
                    {busy === d.id ? "…" : <DownloadIcon />}
                  </button>
                </td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={8} className="p-4 text-center text-gray-500">
                  {rows.length === 0 ? "아직 완성된 설계가 없어요." : "조건에 맞는 설계가 없어요."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {notice && (
        <Modal
          tone="amber"
          title="한글 양식으로 옮겨 주세요"
          onClose={() => setNotice(null)}
          actions={
            <>
              <button type="button" onClick={() => setNotice(null)} className="rounded-lg border border-gray-300 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50">
                취소
              </button>
              <button type="button" onClick={proceed} className="rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white hover:bg-brand-700">
                {notice.action === "view" ? "확인하고 보기" : "확인하고 내려받기"}
              </button>
            </>
          }
        >
          <p>
            이 문서는 앱이 만든 <b>docx 양식</b>이에요. 제출할 때는 내용을 <b>한글(hwp) 양식에 복사해 붙여</b> 양식을 맞춰 주세요.
          </p>
          <p className="text-sm text-gray-600">양식 예시는 광양중동초등학교 예시안을 참고하세요.</p>
          <ExamplesButton />
        </Modal>
      )}
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
