"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { REGION_VALUES } from "@/domain/regions";
import { Card, inputClass } from "../ui";

interface Row {
  region: string;
  schoolName: string;
  password: string;
}
interface Result {
  row: number;
  schoolName: string;
  ok: boolean;
  message: string;
}

const HEADERS = ["지역(시·군·구)", "학교명", "비밀번호"];

/** 엑셀 양식: '학교 목록'(지역은 드롭다운) + '지역' 목록 + '안내' */
async function downloadTemplate() {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("학교 목록");
  const list = wb.addWorksheet("지역");
  REGION_VALUES.forEach((r, i) => (list.getCell(i + 1, 1).value = r));
  ws.columns = [{ width: 18 }, { width: 26 }, { width: 18 }];
  ws.addRow(HEADERS);
  ws.getRow(1).eachCell((c) => {
    c.font = { bold: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2EFE7" } };
    c.alignment = { horizontal: "center" };
  });
  for (let r = 2; r <= 501; r++) {
    ws.getCell(r, 1).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [`지역!$A$1:$A$${REGION_VALUES.length}`],
      showErrorMessage: true,
      errorTitle: "지역",
      error: "목록에서 지역을 골라 주세요.",
    };
    ws.getCell(r, 3).numFmt = "@";
  }
  ws.views = [{ state: "frozen", ySplit: 1 }];
  const guide = wb.addWorksheet("안내");
  [
    "학교 일괄 등록 양식",
    "",
    "1. '학교 목록' 시트의 2번째 줄부터 한 줄에 한 학교씩 적어요. (최대 500개)",
    "2. 지역: 칸을 누르면 나오는 목록에서 골라요.",
    "3. 학교명: 정식 명칭으로 적어요. 예: 광양중동초등학교 (○○초 X). 띄어쓰기는 무시해요.",
    "4. 비밀번호: 8자 이상. 등록하면 그 학교는 바로 이 비밀번호로 로그인할 수 있어요.",
    "5. 비밀번호가 들어 있으니 등록이 끝나면 파일을 안전하게 지우거나 보관해 주세요.",
    "",
    "예) 광양시 | 광양중동초등학교 | gwangyang2027!",
  ].forEach((t, i) => (guide.getCell(i + 1, 1).value = t));
  guide.getCell(1, 1).font = { bold: true, size: 14 };
  guide.getColumn(1).width = 90;
  const buf = await wb.xlsx.writeBuffer();
  save(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "학교_일괄등록_양식.xlsx");
}

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 올린 엑셀에서 학교 줄 읽기 (첫 시트, 첫 줄은 제목, 빈 줄은 건너뜀) */
async function readRows(file: File): Promise<Row[]> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.getWorksheet("학교 목록") ?? wb.worksheets[0];
  if (!ws) return [];
  const text = (v: unknown): string => {
    if (v == null) return "";
    if (typeof v === "object" && v !== null && "text" in v) return String((v as { text: unknown }).text ?? "");
    if (typeof v === "object" && v !== null && "result" in v) return String((v as { result: unknown }).result ?? "");
    return String(v);
  };
  const rows: Row[] = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const [region, schoolName, password] = [1, 2, 3].map((c) => text(row.getCell(c).value).trim());
    if (region || schoolName || password) rows.push({ region, schoolName, password });
  });
  return rows;
}

/** 관리자: 학교 개별 추가 + 엑셀 일괄 등록 */
export function BulkUsers({ onDone }: { onDone: () => void }) {
  const [one, setOne] = useState<Row>({ region: "", schoolName: "", password: "" });
  const [rows, setRows] = useState<Row[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [results, setResults] = useState<Result[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState("");

  const send = async (list: Row[]) => {
    setBusy(true);
    setError("");
    try {
      const r = await api<{ results: Result[] }>("/api/admin/users/bulk", { method: "POST", body: { rows: list } });
      setResults(r.results);
      onDone();
      return r.results;
    } catch (e) {
      setError(e instanceof Error ? e.message : "등록하지 못했어요.");
      return null;
    } finally {
      setBusy(false);
    }
  };
  const addOne = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await send([one]);
    if (r?.[0]?.ok) setOne({ region: one.region, schoolName: "", password: "" });
  };
  const load = async (file: File | undefined) => {
    if (!file) return;
    setResults(null);
    setError("");
    if (!/\.xlsx$/i.test(file.name)) return setError("엑셀(.xlsx) 파일만 올릴 수 있어요. 양식을 내려받아 써 주세요.");
    try {
      const list = await readRows(file);
      if (list.length === 0) return setError("파일에 학교 줄이 없어요. '학교 목록' 시트 2번째 줄부터 적어 주세요.");
      setRows(list);
      setFileName(file.name);
    } catch {
      setError("파일을 읽지 못했어요. 양식을 내려받아 다시 적어 주세요.");
    }
  };

  return (
    <Card className="space-y-4">
      <h2 className="font-bold">학교 등록</h2>
      <form onSubmit={addOne} className="flex flex-wrap items-end gap-2">
        <label className="space-y-1 text-sm">
          <span className="block font-semibold">지역</span>
          <select required className={`${inputClass} w-36`} value={one.region} onChange={(e) => setOne({ ...one, region: e.target.value })}>
            <option value="" disabled>
              고르세요
            </option>
            {REGION_VALUES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="block font-semibold">학교명</span>
          <input required className={`${inputClass} w-56`} placeholder="○○초등학교" value={one.schoolName} onChange={(e) => setOne({ ...one, schoolName: e.target.value })} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="block font-semibold">비밀번호 (8자 이상)</span>
          <input required minLength={8} className={`${inputClass} w-44`} value={one.password} onChange={(e) => setOne({ ...one, password: e.target.value })} />
        </label>
        <button type="submit" disabled={busy} className="rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white hover:bg-brand-700 disabled:bg-gray-300">
          + 개별 추가
        </button>
      </form>

      <div className="space-y-2 border-t border-gray-100 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">엑셀로 한꺼번에 등록 (등록하면 바로 사용 중)</p>
          <button type="button" onClick={() => void downloadTemplate()} className="rounded-lg border border-brand-500 px-3 py-1.5 text-sm font-semibold text-brand-700 hover:bg-brand-50">
            양식 내려받기 (.xlsx)
          </button>
        </div>
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            void load(e.dataTransfer.files[0]);
          }}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-sm ${drag ? "border-brand-500 bg-brand-50" : "border-gray-300 text-gray-500 hover:border-brand-500"}`}
        >
          <span className="font-semibold">엑셀 파일을 여기에 끌어다 놓거나 눌러서 고르세요</span>
          <span className="text-xs">지역 · 학교명 · 비밀번호</span>
          <input type="file" accept=".xlsx" className="hidden" onChange={(e) => void load(e.target.files?.[0])} />
        </label>
      </div>

      {error && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}

      {rows && !results && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm">
              <b>{fileName}</b>에서 학교 {rows.length}개를 읽었어요. 확인하고 등록하세요.
            </p>
            <span className="flex gap-2">
              <button type="button" onClick={() => setRows(null)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                취소
              </button>
              <button type="button" disabled={busy} onClick={() => void send(rows)} className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:bg-gray-300">
                {busy ? "등록하는 중…" : `${rows.length}개 등록하기`}
              </button>
            </span>
          </div>
          <div className="max-h-64 overflow-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 text-left text-xs text-gray-500">
                <tr>
                  <th className="p-2">#</th>
                  {HEADERS.map((h) => (
                    <th key={h} className="p-2">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td className="p-2 text-gray-400">{i + 1}</td>
                    <td className="p-2">{r.region}</td>
                    <td className="p-2">{r.schoolName}</td>
                    <td className="p-2 text-gray-400">{"•".repeat(Math.min(12, r.password.length))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {results && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">
            등록 결과: <span className="text-green-700">{results.filter((r) => r.ok).length}개 등록</span>
            {results.some((r) => !r.ok) && <span className="text-red-600"> · {results.filter((r) => !r.ok).length}개 안 됨</span>}
          </p>
          <ul className="max-h-64 space-y-1 overflow-auto text-sm">
            {results.map((r) => (
              <li key={r.row} className={`rounded px-2 py-1 ${r.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>
                {r.row}. {r.schoolName || "(학교명 없음)"} — {r.message}
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => (setResults(null), setRows(null))} className="text-sm text-gray-500 underline">
            닫기
          </button>
        </div>
      )}
    </Card>
  );
}
