"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { buildFixPrompt } from "@/prompts/common";
import { buildImportPrompt, CODE_NOTE_START, codeDiffNote, formChangesOf, IMPORT_PART2_PROMPT, parseImport, uniqueName, type MissingField } from "@/prompts/importDoc";
import { DESIGN_TYPES, GRADES, OPENING_TYPES, OPERATION_MODES, SUBJECT_GROUPS, type DesignDoc } from "@/domain/types";
import { readDocument, type ReadResult } from "@/import/readDocument";
import { Modal } from "./Modal";
import { CopyBox, inputClass } from "./ui";

const nextSchoolYear = () => {
  const now = new Date();
  return (now.getMonth() >= 2 ? now.getFullYear() : now.getFullYear() - 1) + 1;
};

const FIX_REMINDER = `- 1부는 "part": 1, 2부는 "part": 2 를 넣습니다.
- 처음에 보낸 문서의 문장을 글자 그대로 옮기고, 없는 내용은 빈칸으로 둡니다.
- 형식 예시의 괄호 안 말이나 다른 설계의 내용을 쓰지 않습니다.`;

/**
 * '설계안 가져오기 → 우리 학교 기존 문서' 탭.
 * 한글(hwpx) 파일의 글자를 브라우저에서 뽑아 프롬프트에 넣고, 교사가 AI에 보내 받은 1부·2부 답을 읽어 새 설계로 저장한다.
 * (PDF는 표가 섞여 읽혀 받지 않음 — 사용자 결정, 2026-11-11)
 * 파일은 서버로 보내지 않는다. 문서 내용은 고치지 않고 그대로 넣고, 지침에 안 맞는 곳은 설계 화면에서 빨간색으로 보인다.
 * 앱이 자동으로 고친 것·문서에 없는 필수 정보는 저장하기 전에 팝업으로 꼭 보여 주고 확인받는다.
 */
export function DocumentImport({ schoolName }: { schoolName: string }) {
  const thisYear = nextSchoolYear();
  const [year, setYear] = useState(String(thisYear));
  const [file, setFile] = useState<{ name: string; result: ReadResult } | null>(null);
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState("");
  const [answer1, setAnswer1] = useState("");
  const [answer2, setAnswer2] = useState("");
  /** '답변 초기화' 확인 팝업: 몇 부 답을 지울지 */
  const [clearPart, setClearPart] = useState<1 | 2 | null>(null);
  const [error, setError] = useState("");
  const [multiple, setMultiple] = useState(0);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ id: string; name: string; notes: string[]; fixes: string[]; formChanges: string[] } | null>(null);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);


  const pick = async (f: File | undefined) => {
    if (!f) return;
    setReading(true);
    setReadError("");
    setFile(null);
    setAnswer1("");
    setAnswer2("");
    setError("");
    try {
      setFile({ name: f.name, result: await readDocument(f) });
    } catch (e) {
      setReadError(e instanceof Error ? e.message : "파일을 읽지 못했어요.");
    } finally {
      setReading(false);
      if (input.current) input.current.value = "";
    }
  };

  /** 가져오기 전 확인 팝업: 고를 칸 + 자동으로 고친 것 + 알림 */
  const [ask, setAsk] = useState<{ doc: DesignDoc; notes: string[]; fixes: string[]; formChanges: string[]; missing: MissingField[]; originalCodes: Record<string, string> } | null>(null);

  const importNow = () => {
    const r = parseImport(answer1, answer2, { schoolYear: year, schoolName, sourceText: file?.result.text });
    if (!r.ok) {
      if (r.multiple) {
        setMultiple(r.multiple);
        setError("");
      } else setError(r.error);
      return;
    }
    setError("");
    // 가져오기 전에 항상 확인받는다: 고를 칸·자동으로 고친 것·알림·2027 양식에 맞춰 바뀌는 것
    setAsk(r);
  };

  const save = async (doc: DesignDoc, baseNotes: string[], fixes: string[], formChanges: string[]) => {
    setBusy(true);
    try {
      // 같은 학년도에 같은 이름이 있으면 '이름 (2)'로
      const mine = await api<{ designs: { name: string; schoolYear: string }[] }>("/api/designs");
      const before = doc.basic.name;
      doc.basic.name = uniqueName(before || "가져온 설계", mine.designs.filter((d) => d.schoolYear === year).map((d) => d.name));
      const notes = [...baseNotes];
      if (before && doc.basic.name !== before) notes.unshift(`${year}학년도에 같은 이름의 설계가 있어 「${doc.basic.name}」(으)로 넣었어요.`);
      const saved = await api<{ record: { id: string } }>("/api/designs", { method: "POST", body: { doc } });
      setDone({ id: saved.record.id, name: doc.basic.name, notes, fixes, formChanges });
      setFile(null);
      setAnswer1("");
      setAnswer2("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장하지 못했어요.");
    } finally {
      setBusy(false);
    }
  };

  const stepTitle = "flex items-center gap-2 font-bold text-gray-800";
  const num = "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm text-white";

  return (
    <div className="space-y-5">
      <div className="space-y-1 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
        <p>
          ⚠ <b>한 파일에 설계 하나만</b> 올려 주세요. 여러 학년·여러 과목이 한 파일에 들어 있으면 가져오지 않아요. (설계마다 파일을 나눠 저장한 뒤 하나씩 올려 주세요)
        </p>
        <p>문서 내용은 고치지 않고 그대로 가져와요. 지침에 맞지 않는 곳은 설계 화면의 단계 번호가 빨간색으로 표시되니 들어가서 고쳐 주세요.</p>
      </div>

      {/* ① 학년도 + 파일 */}
      <section className="space-y-3">
        <p className={stepTitle}>
          <span className={num}>1</span> 학년도를 고르고 파일을 올리세요
        </p>
        <label className="flex items-center gap-2 text-sm">
          <span className="shrink-0 font-semibold text-gray-700">가져올 학년도</span>
          <select className={`${inputClass} !w-40`} value={year} onChange={(e) => setYear(e.target.value)}>
            {[thisYear + 1, thisYear, thisYear - 1, thisYear - 2].map((y) => (
              <option key={y} value={y}>
                {y}학년도
              </option>
            ))}
          </select>
        </label>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            void pick(e.dataTransfer.files[0]);
          }}
          className={`flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 text-center text-sm ${drag ? "border-brand-500 bg-brand-50" : "border-gray-300 bg-gray-50"}`}
        >
          <p className="text-gray-600">
            한글(.hwpx) 파일을 여기에 끌어다 놓거나{" "}
            <button type="button" onClick={() => input.current?.click()} className="font-semibold text-brand-700 underline">
              파일 고르기
            </button>
          </p>
          <p className="text-xs text-gray-500">
            한글(hwpx) 파일만 올릴 수 있어요. 예전 한글 파일(.hwp)은 한글에서 <b>[파일] → [다른 이름으로 저장] → 파일 형식 'HWPX'</b>로 저장해 올려 주세요. (PDF는 표가 섞여 읽혀서 받지 않아요)
            <br />
            파일은 서버로 보내지 않고 이 컴퓨터에서만 읽어요.
          </p>
          <input ref={input} type="file" accept=".hwpx" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
          {reading && <p className="font-semibold text-gray-700">파일을 읽는 중…</p>}
          {readError && <p className="font-semibold text-red-600">{readError}</p>}
          {file && (
            <p className="font-semibold text-brand-700">
              ✓ {file.name} — 글자 {file.result.text.length.toLocaleString()}자를 읽었어요
            </p>
          )}
        </div>
      </section>

      {file && (
        <>
          {/* ② 1부 */}
          <section className="space-y-3">
            <p className={stepTitle}>
              <span className={num}>2</span> 프롬프트를 복사해 AI에 보내고, 답(1부)을 붙여 넣으세요
            </p>
            <p className="text-xs text-amber-700">문서에 학생 이름 등 개인정보가 있으면 지우고 보내세요.</p>
            <CopyBox
              text={buildImportPrompt(file.result.text)}
              label="프롬프트 복사"
              rows={5}
              extra={
                <button
                  type="button"
                  onClick={() => setClearPart(1)}
                  disabled={!answer1.trim()}
                  className="rounded-lg border border-red-100 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 disabled:border-gray-100 disabled:bg-gray-50 disabled:text-gray-300"
                >
                  답변 초기화
                </button>
              }
            />
            <textarea
              rows={5}
              className={`${inputClass} font-mono text-xs`}
              placeholder="AI의 1부 답을 통째로 복사해 붙여 넣으세요."
              value={answer1}
              onChange={(e) => setAnswer1(e.target.value)}
            />
          </section>

          {/* ③ 2부 */}
          <section className="space-y-3">
            <p className={stepTitle}>
              <span className={num}>3</span> 같은 AI 대화창에 2부 요청을 보내고, 답(2부)을 붙여 넣으세요
            </p>
            <CopyBox
              text={IMPORT_PART2_PROMPT}
              label="2부 요청 복사"
              rows={3}
              extra={
                <button
                  type="button"
                  onClick={() => setClearPart(2)}
                  disabled={!answer2.trim()}
                  className="rounded-lg border border-red-100 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 disabled:border-gray-100 disabled:bg-gray-50 disabled:text-gray-300"
                >
                  답변 초기화
                </button>
              }
            />
            <textarea
              rows={5}
              className={`${inputClass} font-mono text-xs`}
              placeholder="AI의 2부 답(단원 지도계획·평가 계획)을 통째로 붙여 넣으세요. 답이 끊겼다면 '이어서'를 보내고 이어진 답까지 함께 붙여 넣으세요."
              value={answer2}
              onChange={(e) => setAnswer2(e.target.value)}
            />
          </section>

          {error && (
            <div className="space-y-2 rounded-lg bg-red-50 p-3 text-sm">
              <p className="font-semibold text-red-700">답을 읽지 못했어요: {error}</p>
              <p className="text-gray-700">
                아래 <b>수정 요청</b>을 복사해 <b>같은 AI 대화창</b>에 보내고, 새 답을 다시 붙여 넣어 보세요.
              </p>
              <CopyBox text={buildFixPrompt(error, FIX_REMINDER)} label="수정 요청 복사" rows={4} />
            </div>
          )}
          <button
            type="button"
            onClick={importNow}
            disabled={!answer1.trim() || busy}
            className="rounded-lg bg-brand-600 px-5 py-2 font-bold text-white hover:bg-brand-700 disabled:bg-gray-300"
          >
            {busy ? "가져오는 중…" : "설계 현황으로 가져오기"}
          </button>
        </>
      )}

      {clearPart && (
        <Modal
          title="답변 초기화"
          onClose={() => setClearPart(null)}
          actions={
            <>
              <button type="button" onClick={() => setClearPart(null)} className="rounded-lg border border-gray-300 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50">
                닫기
              </button>
              <button
                type="button"
                onClick={() => {
                  if (clearPart === 1) setAnswer1("");
                  else setAnswer2("");
                  setError("");
                  setClearPart(null);
                }}
                className="rounded-lg bg-red-600 px-5 py-2 font-bold text-white hover:bg-red-700"
              >
                초기화
              </button>
            </>
          }
        >
          <p className="font-semibold">붙여 넣은 {clearPart}부 답을 모두 지울까요?</p>
          <p className="text-sm text-gray-600">지운 뒤 AI의 새 답을 다시 붙여 넣으면 돼요.</p>
        </Modal>
      )}
      {ask && (
        <ConfirmImportModal
          missing={ask.missing}
          fixes={ask.fixes}
          notes={ask.notes}
          sourceText={file?.result.text ?? ""}
          doc={ask.doc}
          onClose={() => setAsk(null)}
          onConfirm={(doc) => {
            // 편성 교과·학년이 바뀌면 성취기준 코드 알림도 다시 계산
            const code = codeDiffNote(doc, ask.originalCodes);
            const notes = [...ask.notes.filter((n) => !n.startsWith(CODE_NOTE_START)), ...(code ? [code] : [])];
            const fixes = ask.fixes;
            // 팝업에서 과목/활동을 골랐으면 양식 차이도 그에 맞게 다시
            const formChanges = formChangesOf(doc, file?.result.text ?? "");
            setAsk(null);
            void save(doc, notes, fixes, formChanges);
          }}
        />
      )}
      {multiple > 0 && (
        <Modal
          title="한 번에 하나씩만 가져올 수 있어요"
          onClose={() => setMultiple(0)}
          actions={
            <button type="button" onClick={() => setMultiple(0)} className="rounded-lg bg-red-600 px-5 py-2 font-bold text-white hover:bg-red-700">
              닫기
            </button>
          }
        >
          <p className="font-semibold">이 파일에는 설계가 {multiple}개 들어 있어요.</p>
          <p className="text-sm">
            한글에서 <b>설계마다 파일을 나눠 저장</b>한 뒤(hwpx), 하나씩 올려 주세요. (예: 3학년 부분만 남기고 다른 이름으로 저장)
          </p>
        </Modal>
      )}
      {done && (
        <Modal
          title="설계 현황에 반영되었어요"
          tone="brand"
          wide
          onClose={() => setDone(null)}
          actions={
            <>
              <button type="button" onClick={() => setDone(null)} className="rounded-lg border border-gray-300 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50">
                닫기
              </button>
              <Link href="/designs" className="rounded-lg border border-brand-600 px-4 py-2 font-semibold text-brand-700 hover:bg-brand-50">
                설계 현황 보기
              </Link>
              <Link href={`/designs/${done.id}`} className="rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white hover:bg-brand-700">
                바로 열기
              </Link>
            </>
          }
        >
          <p>
            「<b>{done.name}</b>」을(를) {year}학년도 설계로 가져왔어요.
          </p>
          <p className="text-sm text-gray-600">설계를 열면 단계마다 내용이 들어가 있어요. 지침에 맞지 않는 곳이 있는 단계는 번호가 빨간색으로 보여요.</p>
          <NoteLists fixes={done.fixes} notes={done.notes} formChanges={done.formChanges} />
        </Modal>
      )}
    </div>
  );
}

const FIELD_LABEL: Record<MissingField["key"], string> = {
  type: "과목 / 활동",
  name: "과목명·활동명",
  grade: "학년",
  semester: "학기",
  hours: "운영 시수",
  subjectGroup: "편성 교과",
  openingType: "개설 형태",
  operationMode: "운영 방식",
  abbrev: "성취기준 코드의 과목명 약어 (2~3자)",
};

/** 앱이 자동으로 고친 것(주황) + 알림(파랑) + 2027 양식에 맞춰 바뀌는 것(회색) 목록 */
function NoteLists({ fixes, notes, formChanges = [] }: { fixes: string[]; notes: string[]; formChanges?: string[] }) {
  return (
    <>
      {fixes.length > 0 && (
        <div className="space-y-1">
          <p className="text-sm font-bold text-amber-800">앱이 자동으로 고친 것 ({fixes.length}가지)</p>
          <ul className="space-y-1">
            {fixes.map((n) => (
              <li key={n} className="rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
                🔧 {n}
              </li>
            ))}
          </ul>
        </div>
      )}
      {notes.length > 0 && (
        <div className="space-y-1">
          <p className="text-sm font-bold text-blue-800">알림 ({notes.length}가지)</p>
          <ul className="space-y-1">
            {notes.map((n) => (
              <li key={n} className="rounded-lg bg-blue-50 p-2 text-sm text-blue-800">
                ℹ️ {n}
              </li>
            ))}
          </ul>
        </div>
      )}
      {formChanges.length > 0 && (
        <div className="space-y-1">
          <p className="text-sm font-bold text-gray-700">2027 양식에 맞춰 문서에서 바뀌는 것 ({formChanges.length}가지)</p>
          <ul className="space-y-1">
            {formChanges.map((n) => (
              <li key={n} className="rounded-lg bg-gray-100 p-2 text-sm text-gray-700">
                📄 {n}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

/**
 * 가져오기 전 확인 팝업 (사용자 결정, 2026-11-11)
 * - 문서에서 알 수 없는 필수 정보: 고르거나 입력해야 가져오기가 눌림
 * - 앱이 자동으로 고친 것과 알림: 모두 보여 주고 확인받음
 */
function ConfirmImportModal({
  missing,
  fixes,
  notes,
  sourceText,
  doc,
  onClose,
  onConfirm,
}: {
  missing: MissingField[];
  fixes: string[];
  notes: string[];
  sourceText: string;
  doc: DesignDoc;
  onClose: () => void;
  onConfirm: (doc: DesignDoc) => void;
}) {
  const [v, setV] = useState<Record<string, string>>({});
  const set = (k: string, val: string) => setV((o) => ({ ...o, [k]: val }));
  const filled = (k: MissingField["key"]) => {
    const x = (v[k] ?? "").trim();
    if (k === "hours") return Number(x) >= 1 && Number(x) <= 40;
    if (k === "name") return x.length > 0 && x.length <= 40;
    if (k === "abbrev") return /^[가-힣A-Za-z]{2,3}$/.test(x);
    return x.length > 0;
  };
  const ready = missing.every((m) => filled(m.key));
  const confirm = () => {
    const next = structuredClone(doc);
    for (const { key } of missing) {
      const x = v[key].trim();
      if (key === "type") next.basic.type = x as DesignDoc["basic"]["type"];
      else if (key === "name") next.basic.name = x;
      else if (key === "grade") next.basic.grade = Number(x) as DesignDoc["basic"]["grade"];
      else if (key === "semester") next.basic.semester = Number(x) as 1 | 2;
      else if (key === "hours") next.basic.hours = Number(x);
      else if (key === "subjectGroup") next.basic.subjectGroup = x;
      else if (key === "openingType") next.basic.openingType = x as DesignDoc["basic"]["openingType"];
      else if (key === "abbrev") next.abbrev = x;
      else next.basic.operationMode = x as DesignDoc["basic"]["operationMode"];
    }
    onConfirm(next);
  };
  const select = (k: string, options: { value: string; label: string }[]) => (
    <select className={inputClass} value={v[k] ?? ""} onChange={(e) => set(k, e.target.value)}>
      <option value="">골라 주세요</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
  const plain = (list: readonly (string | number)[], suffix = "") => list.map((x) => ({ value: String(x), label: `${x}${suffix}` }));
  return (
    <Modal
      title={missing.length ? "문서에서 찾지 못한 정보를 골라 주세요" : "가져오기 전에 확인해 주세요"}
      tone="amber"
      wide
      onClose={onClose}
      actions={
        <>
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50">
            닫기
          </button>
          <button type="button" onClick={confirm} disabled={!ready} className="rounded-lg bg-brand-600 px-5 py-2 font-bold text-white hover:bg-brand-700 disabled:bg-gray-300">
            확인하고 가져오기
          </button>
        </>
      }
    >
      {missing.length > 0 && (
        <p className="text-sm text-gray-600">
          「{doc.basic.name || "이름 없음"}」의 아래 칸은 문서에 없거나 앱의 선택지와 달라요. <b>꼭 필요한 정보</b>라 골라 주셔야 가져올 수 있어요. (나중에 기본 정보 단계에서도 고칠 수 있어요)
        </p>
      )}
      <div className="space-y-3">
        {missing.map(({ key, raw }) => (
          <label key={key} className="block space-y-1">
            <span className="text-sm font-semibold">
              {FIELD_LABEL[key]} <span className="font-normal text-gray-500">(문서: {raw || "없음"})</span>
            </span>
            {key === "type" && select(key, Object.entries(DESIGN_TYPES).map(([value, label]) => ({ value, label })))}
            {key === "name" && <input className={inputClass} maxLength={40} value={v.name ?? ""} onChange={(e) => set("name", e.target.value)} />}
            {key === "grade" && select(key, plain(GRADES, "학년"))}
            {key === "semester" && select(key, plain([1, 2], "학기"))}
            {key === "hours" && <input type="number" min={1} max={40} className={inputClass} value={v.hours ?? ""} onChange={(e) => set("hours", e.target.value)} placeholder="1~40" />}
            {key === "subjectGroup" && select(key, plain(SUBJECT_GROUPS))}
            {key === "openingType" && select(key, plain(OPENING_TYPES))}
            {key === "operationMode" && select(key, plain(OPERATION_MODES))}
            {key === "abbrev" && <input className={inputClass} maxLength={3} value={v.abbrev ?? ""} onChange={(e) => set("abbrev", e.target.value.trim())} placeholder="예: 지구, 디탐" />}
          </label>
        ))}
      </div>
      {/* 과목/활동을 팝업에서 고르면 양식 차이도 바로 그에 맞게 */}
      <NoteLists fixes={fixes} notes={notes} formChanges={formChangesOf(missing.some((m) => m.key === "type") && v.type ? { ...doc, basic: { ...doc.basic, type: v.type as DesignDoc["basic"]["type"] } } : doc, sourceText)} />
    </Modal>
  );
}
