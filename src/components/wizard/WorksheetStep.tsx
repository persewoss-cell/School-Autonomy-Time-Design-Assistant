"use client";

import { Packer } from "docx";
import { useState } from "react";
import {
  ACTIVITY_FORMS,
  BLOCK_KEYS,
  BLOCK_TYPES,
  BOX_HEIGHT_CM,
  BOX_SIZES,
  blankSheet,
  emptyWorksheets,
  fillSheet,
  GROUPINGS,
  lessonSlots,
  NO_SHEET,
  normalizeBlock,
  ROW_CM,
  sheetHeightCm,
  BODY_CM,
  slotLabel,
  unitTitle,
  WORKSHEET_COLORS,
  worksheetIssues,
  type BlockType,
  type Worksheet,
  type WorksheetBlock,
  type WorksheetColor,
  type Worksheets,
} from "@/domain/worksheet";
import { buildWorksheetDocx } from "@/export/worksheetDocx";
import { sendLog } from "@/lib/api";
import { unitSlots, worksheetPrompt } from "@/prompts/worksheet";
import { AiAssist } from "./AiAssist";
import type { StepProps } from "./DocSteps";
import { Card, Chips, Field, NavButtons, StepHeader, inputClass, toggle } from "../ui";

/**
 * (선택) 차시별 활동지 단계. 점검·내려받기 다음에 있고, 하지 않아도 설계 완성에는 영향이 없다.
 * 단원별로 프롬프트를 만들어 AI에게 활동지 구성을 받고, 앱에서 고친 뒤 .docx로 내려받는다.
 */
export function WorksheetStep({ doc, setDoc, onBack }: StepProps) {
  const ws: Worksheets = doc.worksheets ?? emptyWorksheets();
  const st = ws.settings;
  const plan = doc.plan.selected;
  const [unit, setUnit] = useState(0);
  const update = (fn: (w: Worksheets) => void) =>
    setDoc((d) => {
      d.worksheets ??= emptyWorksheets();
      fn(d.worksheets);
    });

  if (!plan) {
    return (
      <div className="space-y-4">
        <StepHeader title="차시별 활동지 (선택)" />
        <Card>
          <p className="text-gray-700">단원 지도계획을 먼저 완성해 주세요. 활동지는 단원 지도계획의 차시마다 만들어요.</p>
        </Card>
        <NavButtons onBack={onBack} />
      </div>
    );
  }

  const slots = lessonSlots(doc);
  const unitNos = slots.filter((s) => s.unitIndex === unit).map((s) => s.no);
  const unitSheets = ws.sheets.filter((s) => unitNos.includes(s.no)).sort((a, b) => a.no - b.no);
  const setSheet = (no: number, fn: (s: Worksheet) => void) => update((w) => fn(w.sheets.find((s) => s.no === no)!));

  const download = async (nos?: number[], suffix = "전체", teacher = false) => {
    const blob = await Packer.toBlob(buildWorksheetDocx(doc, nos, { teacher }));
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${doc.basic.name || "활동지"}_${teacher ? "교사용 예시 답안" : "활동지"}_${suffix}.docx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    sendLog("worksheet_download", `${doc.basic.name} ${suffix}${teacher ? " (교사용 예시 답안)" : ""}`);
  };

  return (
    <div className="space-y-4">
      <StepHeader
        title="차시별 활동지 (선택)"
        tips={[
          "이 단계는 선택이에요. 하지 않아도 설계 문서 완성·내려받기에는 영향이 없어요.",
          "단원 지도계획의 차시마다 A4 한 장짜리 활동지를 만들어요. 아래 칸은 모두 선택이고, 비워 두면 AI가 차시 내용에 맞게 정해요.",
          "단원을 골라 프롬프트를 AI에 보내고 답을 붙여 넣으면, 아래에서 고치고 .docx로 내려받을 수 있어요.",
        ]}
        action={
          ws.sheets.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void download()} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
                전체 활동지 내려받기 ({ws.sheets.length}장)
              </button>
              <button type="button" onClick={() => void download(undefined, "전체", true)} className="rounded-lg border-2 border-blue-600 px-4 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-50">
                교사용 예시 답안 내려받기
              </button>
            </div>
          )
        }
      />

      <Card className="space-y-4">
        <h2 className="font-bold">활동지 설정 (모두 선택)</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="사용 자료" hint="책·영상·교재 이름 등 (예: 「고래는 왜 돌아왔을까?」)">
            <textarea rows={2} className={inputClass} value={st.material} onChange={(e) => update((w) => void (w.settings.material = e.target.value))} />
          </Field>
          <Field label="학생 수준·특성" hint="예: 글쓰기를 어려워함, 그리기를 좋아함 (학생 이름 등 개인정보는 쓰지 마세요)">
            <textarea rows={2} className={inputClass} value={st.learners} onChange={(e) => update((w) => void (w.settings.learners = e.target.value))} />
          </Field>
          <Field label="활동 방식">
            <select className={inputClass} value={st.grouping} onChange={(e) => update((w) => void (w.settings.grouping = e.target.value))}>
              {GROUPINGS.map((g) => (
                <option key={g} value={g}>
                  {g || "알아서 (차시에 맞게)"}
                </option>
              ))}
            </select>
          </Field>
          <div className="space-y-1">
            <span className="text-sm font-semibold">표·상자 색</span>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(WORKSHEET_COLORS) as WorksheetColor[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => update((w) => void (w.settings.color = c))}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm ${st.color === c ? "border-brand-600 bg-brand-50 font-semibold text-brand-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}
                >
                  <span className="h-4 w-4 rounded border-2" style={{ borderColor: `#${WORKSHEET_COLORS[c].line}`, background: `#${WORKSHEET_COLORS[c].fill}` }} />
                  {WORKSHEET_COLORS[c].label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <LogoPicker logo={st.logo} onChange={(logo) => update((w) => void (w.settings.logo = logo))} />
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5 h-4 w-4" checked={st.fillPage !== false} onChange={(e) => update((w) => void (w.settings.fillPage = e.target.checked))} />
          <span>
            <b>남는 공간 채우기</b> — A4 아래쪽이 비면 마지막 쓰기·그리기 칸(줄·상자·표·원고지)을 늘려 한 장을 채워요. (미리보기·내려받기에 적용, 칸 수 설정은 그대로)
          </span>
        </label>
      </Card>

      {/* 단원 고르기 */}
      <div className="flex flex-wrap gap-1" role="tablist">
        {plan.units.map((u, i) => {
          const n = ws.sheets.filter((s) => slots.find((x) => x.no === s.no)?.unitIndex === i).length;
          return (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={unit === i}
              onClick={() => setUnit(i)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${unit === i ? "bg-brand-600 text-white" : "bg-white text-gray-600 shadow-sm hover:bg-brand-50"}`}
            >
              {i + 1}단원 {n > 0 && <span className="ml-1 text-xs opacity-80">({n}장)</span>}
            </button>
          );
        })}
      </div>

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">{unitTitle(plan.units[unit]?.unitName ?? "", unit)} — 차시별 활동 형태 (선택, 여러 개)</h2>
          {unitSheets.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void download(unitSheets.map((s) => s.no), `${unit + 1}단원`)}
                className="rounded-lg border-2 border-brand-600 px-4 py-1.5 text-sm font-semibold text-brand-700 hover:bg-brand-50"
              >
                이 단원 활동지 내려받기 ({unitSheets.length}장)
              </button>
              <button
                type="button"
                onClick={() => void download(unitSheets.map((s) => s.no), `${unit + 1}단원`, true)}
                className="rounded-lg border border-blue-300 px-3 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-50"
              >
                교사용 예시 답안
              </button>
            </div>
          )}
        </div>
        <p className="text-xs text-gray-500">고르지 않으면 AI가 차시 내용에 맞게 정해요. &lsquo;{NO_SHEET}&rsquo;을 고른 차시는 만들지 않아요.</p>
        <table className="w-full text-sm">
          <tbody>
            {slots
              .filter((s) => s.unitIndex === unit)
              .map((s) => {
                const sel = st.forms[String(s.no)] ?? [];
                return (
                  <tr key={s.no} className="border-t border-gray-100 align-top">
                    <td className="w-16 py-2 font-semibold text-gray-600">{slotLabel(s.no, doc)}</td>
                    <td className="w-56 py-2 pr-2">{s.topic}</td>
                    <td className="py-2">
                      <Chips
                        options={[...ACTIVITY_FORMS, NO_SHEET]}
                        selected={sel}
                        onToggle={(o) =>
                          update((w) => {
                            const cur = w.settings.forms[String(s.no)] ?? [];
                            // '활동지 없음'은 다른 형태와 함께 고를 수 없음
                            w.settings.forms[String(s.no)] = o === NO_SHEET ? (cur.includes(NO_SHEET) ? [] : [NO_SHEET]) : toggle(cur.filter((x) => x !== NO_SHEET), o);
                          })
                        }
                      />
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </Card>

      <AiAssist
        key={unit}
        doc={doc}
        step={worksheetPrompt(unit)}
        title={`AI에게 ${unit + 1}단원 활동지 받기`}
        hasContent={unitSheets.length > 0}
        onApply={(sheets) =>
          update((w) => {
            const nos = sheets.map((s) => s.no);
            w.sheets = [...w.sheets.filter((s) => !nos.includes(s.no)), ...sheets].sort((a, b) => a.no - b.no);
          })
        }
        onManual={() =>
          update((w) => {
            const have = new Set(w.sheets.map((s) => s.no));
            w.sheets = [...w.sheets, ...unitSlots(doc, unit).filter((s) => !have.has(s.no)).map(blankSheet)].sort((a, b) => a.no - b.no);
          })
        }
        onReset={() => update((w) => void (w.sheets = w.sheets.filter((s) => !unitNos.includes(s.no))))}
        resetWhat={`${unit + 1}단원 활동지`}
      />

      {unitSheets.map((s) => (
        <SheetEditor
          key={s.no}
          sheet={s}
          doc={doc}
          onChange={(fn) => setSheet(s.no, fn)}
          onDelete={() => confirm(`${s.no}차시 활동지를 지울까요?`) && update((w) => void (w.sheets = w.sheets.filter((x) => x.no !== s.no)))}
          onReplace={(next) => update((w) => void (w.sheets = w.sheets.map((x) => (x.no === next.no ? next : x))))}
          onCopyTo={(no) => {
            const target = slots.find((x) => x.no === no);
            if (!target) return;
            if (ws.sheets.some((x) => x.no === no) && !confirm(`${no}차시에는 이미 활동지가 있어요. 이 활동지로 덮어쓸까요?`)) return;
            update((w) => {
              const copy: Worksheet = { ...structuredClone(s), no, topic: target.topic };
              w.sheets = [...w.sheets.filter((x) => x.no !== no), copy].sort((a, b) => a.no - b.no);
            });
            if (target.unitIndex !== unit) setUnit(target.unitIndex);
            alert(`${no}차시로 복사했어요. 학습문제와 물음을 그 차시에 맞게 고쳐 주세요.`);
          }}
        />
      ))}

      <NavButtons onBack={onBack} />
    </div>
  );
}

/** 학교 로고: 올리면 160px 안으로 줄여 PNG로 저장 (문서 크기를 작게) */
function LogoPicker({ logo, onChange }: { logo: string; onChange: (v: string) => void }) {
  const pick = (f: File | undefined) => {
    if (!f) return;
    if (!/^image\/(png|jpeg)$/.test(f.type)) return alert("PNG 또는 JPG 그림만 올릴 수 있어요.");
    const img = new Image();
    const url = URL.createObjectURL(f);
    img.onload = () => {
      const scale = Math.min(1, 160 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.width * scale));
      c.height = Math.max(1, Math.round(img.height * scale));
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      onChange(c.toDataURL("image/png"));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm font-semibold">학교 로고</span>
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="학교 로고" className="h-12 w-12 rounded border border-gray-200 object-contain" />
      ) : (
        <span className="text-xs text-gray-500">올리지 않으면 머리칸에 로고 칸 없이 만들어요.</span>
      )}
      <label className="cursor-pointer rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
        {logo ? "바꾸기" : "로고 그림 올리기 (PNG·JPG)"}
        <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      </label>
      {logo && (
        <button type="button" onClick={() => onChange("")} className="text-sm text-gray-500 underline hover:text-red-600">
          로고 지우기
        </button>
      )}
    </div>
  );
}

const lines = (v: string) => v.split("\n");
const linesText = (a?: string[]) => (a ?? []).join("\n");

function SheetEditor({
  sheet,
  doc,
  onChange,
  onDelete,
  onReplace,
  onCopyTo,
}: {
  sheet: Worksheet;
  doc: StepProps["doc"];
  onChange: (fn: (s: Worksheet) => void) => void;
  onDelete: () => void;
  /** '이 차시만 다시 받기'로 받은 활동지로 바꾸기 */
  onReplace: (s: Worksheet) => void;
  /** 다른 차시로 복사 */
  onCopyTo: (no: number) => void;
}) {
  const issues = worksheetIssues(doc, sheet);
  const slots = lessonSlots(doc);
  const unitIndex = slots.find((x) => x.no === sheet.no)?.unitIndex ?? 0;
  const [redo, setRedo] = useState(false);
  const [copyTo, setCopyTo] = useState("");
  const setBlock = (i: number, patch: Partial<WorksheetBlock>) => onChange((s) => void (s.blocks[i] = { ...s.blocks[i], ...patch }));
  const move = (i: number, d: -1 | 1) =>
    onChange((s) => {
      const j = i + d;
      if (j < 0 || j >= s.blocks.length) return;
      [s.blocks[i], s.blocks[j]] = [s.blocks[j], s.blocks[i]];
    });
  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold">
          {slotLabel(sheet.no, doc)} <span className="font-normal text-gray-600">{sheet.topic}</span>
        </h3>
        <div className="flex items-center gap-3 text-sm">
          <span className={sheetHeightCm(sheet) > BODY_CM ? "font-semibold text-red-600" : "text-gray-400"}>
            내용 {Math.round((sheetHeightCm(sheet) / BODY_CM) * 100)}%
            {doc.worksheets?.settings.fillPage !== false && sheetHeightCm(sheet) <= BODY_CM && " · 남는 공간 자동 채움"}
          </span>
          <button type="button" onClick={() => setRedo(!redo)} className="font-semibold text-brand-700 hover:underline">
            {redo ? "다시 받기 닫기" : "이 차시만 AI에게 다시 받기"}
          </button>
          <span className="flex items-center gap-1">
            <select className="rounded border border-gray-300 px-1 py-0.5 text-xs" value={copyTo} onChange={(e) => setCopyTo(e.target.value)} aria-label="복사할 차시">
              <option value="">다른 차시로 복사…</option>
              {slots
                .filter((x) => x.no !== sheet.no)
                .map((x) => (
                  <option key={x.no} value={x.no}>
                    {slotLabel(x.no, doc)} {x.topic.slice(0, 18)}
                  </option>
                ))}
            </select>
            <button
              type="button"
              disabled={!copyTo}
              onClick={() => {
                onCopyTo(Number(copyTo));
                setCopyTo("");
              }}
              className="rounded border border-gray-300 px-2 py-0.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:text-gray-300"
            >
              복사
            </button>
          </span>
          <button type="button" onClick={onDelete} className="text-gray-400 hover:text-red-600">
            활동지 삭제
          </button>
        </div>
      </div>
      {redo && (
        <AiAssist
          doc={doc}
          step={worksheetPrompt(unitIndex, [sheet.no])}
          title={`${slotLabel(sheet.no, doc)} 활동지만 AI에게 다시 받기`}
          hasContent
          defaultOpen
          onApply={(sheets) => {
            const next = sheets.find((x) => x.no === sheet.no);
            if (next) onReplace(next);
            setRedo(false);
          }}
        />
      )}
      {issues.length > 0 && (
        <ul className="space-y-1">
          {issues.map((m) => (
            <li key={m} className="rounded-lg bg-amber-50 p-2 text-sm text-amber-800">
              ⚠ {m}
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <Field label="학습문제">
            <input className={inputClass} value={sheet.problem} onChange={(e) => onChange((s) => void (s.problem = e.target.value))} />
          </Field>
          <Field label="※ 안내 문장 (선택)">
            <input className={inputClass} value={sheet.lead} onChange={(e) => onChange((s) => void (s.lead = e.target.value))} />
          </Field>
          {sheet.blocks.map((b, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-gray-200 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-brand-700">{i + 1}.</span>
                <select
                  className={`${inputClass} !w-auto !py-1 text-sm`}
                  value={b.type}
                  onChange={(e) => onChange((s) => void (s.blocks[i] = normalizeBlock({ ...s.blocks[i], type: e.target.value as BlockType })))}
                >
                  {BLOCK_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {BLOCK_TYPES[k]}
                    </option>
                  ))}
                </select>
                <span className="flex-1" />
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="px-1 text-gray-500 disabled:text-gray-200" title="위로">
                  ▲
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === sheet.blocks.length - 1} className="px-1 text-gray-500 disabled:text-gray-200" title="아래로">
                  ▼
                </button>
                <button type="button" onClick={() => onChange((s) => void s.blocks.splice(i, 1))} className="text-sm text-gray-400 hover:text-red-600">
                  삭제
                </button>
              </div>
              <input className={inputClass} placeholder="물음·지시 (예: 책의 표지를 살펴보세요.)" value={b.title} onChange={(e) => setBlock(i, { title: e.target.value })} />
              <BlockFields b={b} set={(p) => setBlock(i, p)} />
              {b.type !== "list" && b.type !== "example" && (
                <input
                  className={`${inputClass} border-blue-200 text-sm text-blue-900`}
                  placeholder="교사용 예시 답 (선택, 교사용 답안에만 나와요)"
                  value={b.answer ?? ""}
                  onChange={(e) => setBlock(i, { answer: e.target.value })}
                />
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => onChange((s) => void s.blocks.push(normalizeBlock({ type: "lines", title: "" })))}
            className="rounded-lg border border-dashed border-brand-300 px-3 py-1.5 text-sm font-semibold text-brand-700 hover:bg-brand-50"
          >
            + 칸 추가
          </button>
        </div>
        <SheetPreview sheet={sheet} doc={doc} />
      </div>
    </Card>
  );
}

function BlockFields({ b, set }: { b: WorksheetBlock; set: (p: Partial<WorksheetBlock>) => void }) {
  const count = (label: string, max: number, options?: number[]) => (
    <label className="flex items-center gap-2 text-sm">
      {label}
      {options ? (
        <select className={`${inputClass} !w-24 !py-1`} value={b.count} onChange={(e) => set({ count: Number(e.target.value) })}>
          {options.map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      ) : (
        <input type="number" min={1} max={max} className={`${inputClass} !w-24 !py-1`} value={b.count ?? 1} onChange={(e) => set({ count: Math.max(1, Math.min(max, Number(e.target.value) || 1)) })} />
      )}
    </label>
  );
  const area = (label: string, value: string, on: (v: string) => void, rows = 3) => (
    <label className="block space-y-1 text-sm">
      <span className="text-gray-600">{label}</span>
      <textarea rows={rows} className={inputClass} value={value} onChange={(e) => on(e.target.value)} />
    </label>
  );
  switch (b.type) {
    case "lines":
      return count("줄 수", 20);
    case "grid":
      return count("원고지 줄 수", 15);
    case "numbered":
      return count("상자 수", 8);
    case "storyboard":
      return count("칸 수", 9, [4, 6, 9]);
    case "box":
      return (
        <label className="flex items-center gap-2 text-sm">
          크기
          <select className={`${inputClass} !w-32 !py-1`} value={b.size} onChange={(e) => set({ size: e.target.value as WorksheetBlock["size"] })}>
            {Object.entries(BOX_SIZES).map(([k, v]) => (
              <option key={k} value={k}>
                {v} ({BOX_HEIGHT_CM[k as keyof typeof BOX_SIZES]}cm)
              </option>
            ))}
          </select>
        </label>
      );
    case "labels":
      return area("왼쪽 항목 (한 줄에 하나)", linesText(b.rows), (v) => set({ rows: lines(v) }));
    case "selfcheck":
      return area("평가 문장 (한 줄에 하나)", linesText(b.rows), (v) => set({ rows: lines(v) }));
    case "columns":
      return (
        <div className="space-y-2">
          {area("열 제목 (한 줄에 하나, 2~5개)", linesText(b.headers), (v) => set({ headers: lines(v).slice(0, 5) }), 2)}
          {count("빈 행 수", 10)}
        </div>
      );
    case "list":
      return area("안내 줄 (한 줄에 하나)", linesText(b.items), (v) => set({ items: lines(v) }));
    case "example":
      return area("예시 글", b.text ?? "", (v) => set({ text: v }));
  }
}

/** 화면 미리보기 (docx와 같은 모양을 대략. 1cm = 14px) */
function SheetPreview({ sheet: original, doc }: { sheet: Worksheet; doc: StepProps["doc"] }) {
  const st = (doc.worksheets ?? emptyWorksheets()).settings;
  // 내려받을 때와 같게: 남는 공간 채우기
  const sheet = st.fillPage !== false ? fillSheet(original) : original;
  const color = WORKSHEET_COLORS[st.color] ?? WORKSHEET_COLORS.black;
  const line = `#${color.line}`;
  const fill = `#${color.fill}`;
  const px = (cm: number) => Math.round(cm * 14);
  const slot = lessonSlots(doc).find((s) => s.no === sheet.no);
  const cellBorder = { border: `1px solid ${line}` };
  const block = (b: WorksheetBlock) => {
    switch (b.type) {
      case "lines":
        return Array.from({ length: b.count ?? 4 }, (_, i) => <div key={i} style={{ height: px(ROW_CM.line), borderBottom: `1px solid ${line}` }} />);
      case "labels":
        return (
          <table className="w-full border-collapse">
            <tbody>
              {(b.rows ?? []).map((r, i) => (
                <tr key={i} style={{ height: px(ROW_CM.label) }}>
                  <td className="w-1/4 text-center font-bold" style={{ ...cellBorder, background: fill }}>
                    {r}
                  </td>
                  <td style={cellBorder} />
                </tr>
              ))}
            </tbody>
          </table>
        );
      case "columns":
        return (
          <table className="w-full border-collapse">
            <tbody>
              <tr>
                {(b.headers ?? []).map((h, i) => (
                  <td key={i} className="text-center font-bold" style={{ ...cellBorder, background: fill, height: px(ROW_CM.label) }}>
                    {h}
                  </td>
                ))}
              </tr>
              {Array.from({ length: b.count ?? 3 }, (_, r) => (
                <tr key={r} style={{ height: px(ROW_CM.column) }}>
                  {(b.headers ?? []).map((_, i) => (
                    <td key={i} style={cellBorder} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        );
      case "grid":
        return (
          <div className="grid" style={{ gridTemplateColumns: "repeat(20, 1fr)", borderTop: `1px solid ${line}`, borderLeft: `1px solid ${line}` }}>
            {Array.from({ length: 20 * (b.count ?? 6) }, (_, i) => (
              <div key={i} style={{ height: px(ROW_CM.grid), borderRight: `1px dashed ${line}`, borderBottom: `1px solid ${line}` }} />
            ))}
          </div>
        );
      case "box":
        return <div style={{ ...cellBorder, height: px(BOX_HEIGHT_CM[b.size ?? "medium"] + (b.stretchCm ?? 0)) }} />;
      case "numbered":
        return Array.from({ length: b.count ?? 3 }, (_, i) => (
          <div key={i} className="p-1 font-bold" style={{ ...cellBorder, height: px(ROW_CM.numbered + (b.stretchCm ?? 0) / (b.count ?? 3)), marginTop: i ? -1 : 0 }}>
            {i + 1}.
          </div>
        ));
      case "list":
        return (b.items ?? []).map((t, i) => (
          <p key={i}>
            {"①②③④⑤⑥⑦⑧⑨⑩⑪⑫"[i] ?? `${i + 1})`} {t}
          </p>
        ));
      case "storyboard": {
        const n = b.count ?? 6;
        const cols = n === 4 ? 2 : 3;
        return (
          <div className="grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
            {Array.from({ length: n }, (_, i) => (
              <div key={i} style={{ ...cellBorder, height: px(ROW_CM.storyboard), margin: "0 -1px -1px 0" }} />
            ))}
          </div>
        );
      }
      case "selfcheck":
        return (
          <table className="w-full border-collapse">
            <tbody>
              <tr style={{ background: fill }}>
                <td className="text-center font-bold" style={cellBorder}>
                  스스로 평가해요
                </td>
                {[1, 2, 3, 4, 5].map((n) => (
                  <td key={n} className="w-[8%] text-center font-bold" style={cellBorder}>
                    {n}
                  </td>
                ))}
              </tr>
              {(b.rows ?? []).map((r, i) => (
                <tr key={i} style={{ height: px(ROW_CM.selfcheck) }}>
                  <td className="px-1" style={cellBorder}>
                    {r}
                  </td>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <td key={n} style={cellBorder} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        );
      case "example":
        return (
          <div className="whitespace-pre-wrap p-2" style={cellBorder}>
            {b.text}
          </div>
        );
    }
  };
  return (
    <div className="self-start rounded-lg bg-gray-100 p-3">
      <div className="mx-auto bg-white p-3 font-serif text-[11px] leading-snug text-gray-900 shadow" style={{ maxWidth: 420 }}>
        <table className="w-full border-collapse text-center">
          <tbody>
            <tr>
              {st.logo && (
                <td rowSpan={3} className="w-12 border border-black p-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={st.logo} alt="" className="mx-auto h-9 w-9 object-contain" />
                </td>
              )}
              <td colSpan={4} className="border border-black py-1 font-sans font-bold">
                {doc.basic.name}
              </td>
            </tr>
            <tr>
              <td className="w-14 border border-black">단원</td>
              <td className="border border-black">{slot ? unitTitle(slot.unitName, slot.unitIndex) : ""}</td>
              <td className="w-10 border border-black">차시</td>
              <td className="w-12 border border-black">{slotLabel(sheet.no, doc)}</td>
            </tr>
            <tr>
              <td className="border border-black">학습문제</td>
              <td colSpan={3} className="border border-black px-1 text-left">
                {sheet.problem}
              </td>
            </tr>
          </tbody>
        </table>
        <p className="my-1 text-right">{doc.basic.grade}학년 (&nbsp;&nbsp;&nbsp;)반 (&nbsp;&nbsp;&nbsp;)번 이름 (&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)</p>
        <div className="space-y-1 border border-black p-2" style={{ minHeight: px(22.3) }}>
          {sheet.lead.trim() && <p className="font-bold">※ {sheet.lead}</p>}
          {sheet.blocks.map((b, i) => (
            <div key={i} className="space-y-1 pt-1">
              {b.title.trim() && (
                <p>
                  {i + 1}. {b.title}
                </p>
              )}
              {block(b)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
