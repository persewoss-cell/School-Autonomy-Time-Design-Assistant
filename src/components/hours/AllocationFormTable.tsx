"use client";

import { formModel, signed } from "@/domain/allocationForm";
import { withCreativeParts, type AllocationInput, type CreativePart, type FourSemesters, type SemesterIndex } from "@/validation/allocation";

/**
 * 시수 점검 편성표 — 학교 '( )학년 교육과정 편성표' 양식과 같은 줄 구성을 보기 쉽게 정리한 화면용 표.
 * 편성 시수 칸에 바로 입력하고, 증감은 칸 옆에 작게, 교과군 합계 옆에 이상유무를 보여 준다. (.docx는 양식 그대로)
 */

const cellBase = "border-b border-gray-100 px-2 py-1.5 text-center whitespace-nowrap";
const th = "px-2 py-2 text-center text-xs font-semibold text-gray-600 whitespace-nowrap";
const input =
  "w-12 rounded-md border border-gray-300 bg-white px-1 py-1 text-center text-sm [appearance:textfield] focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 [&::-webkit-inner-spin-button]:appearance-none";
const num = (v: string) => Math.max(0, Math.floor(Number(v) || 0));
const n = (v: number) => v.toLocaleString("ko-KR");

/** 증감 표시: 줄면 빨강, 늘면 파랑, 0이면 숨김 */
function Delta({ v, strong = false }: { v: number; strong?: boolean }) {
  if (v === 0) return <span className="inline-block w-8" />;
  return (
    <span className={`inline-block w-8 text-left text-[11px] ${strong ? "font-bold" : ""} ${v < 0 ? "text-red-600" : "text-blue-600"}`}>
      {signed(v)}
    </span>
  );
}

/** 교과군 합계 + 이상유무 */
function GroupTotal({ value, ok, range }: { value: number; ok: boolean; range: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={`text-sm font-bold ${ok ? "text-gray-900" : "text-red-700"}`}>{n(value)}</span>
      <span
        title={ok ? "이상없음" : `증감 범위 ${range} 밖`}
        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${ok ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
      >
        {ok ? "이상없음" : "범위 밖"}
      </span>
    </div>
  );
}

export function AllocationFormTable({
  a,
  setA,
  yearOf,
}: {
  a: AllocationInput;
  setA: (next: AllocationInput) => void;
  /** 학기(0~3)의 학년도 */
  yearOf: (s: SemesterIndex) => number;
}) {
  const m = formModel(a);
  const setSubject = (key: string, sem: number, v: number) => {
    const next = structuredClone(a);
    (next.subjectHours[key] as FourSemesters)[sem] = v;
    setA(next);
  };
  const setPart = (key: CreativePart, sem: number, v: number) => {
    const parts = Object.fromEntries(m.creative.parts.map((p) => [p.key, [...p.hours]])) as Record<CreativePart, FourSemesters>;
    parts[key][sem] = v;
    setA(withCreativeParts(a, parts));
  };
  const years = [0, 1] as const;
  const semOf = (y: number, k: 0 | 1) => (y * 2 + k) as SemesterIndex;
  const yearBorder = "border-l border-gray-200";

  /** 학년별 칸: 배당 | 1학기 | 2학기 | 계 */
  const SumYear = ({ base, A, B, bold = true }: { base: number; A: number; B: number; bold?: boolean }) => (
    <>
      <td className={`${cellBase} ${yearBorder} text-gray-500`}>{n(base / 2)}</td>
      <td className={`${cellBase} ${bold ? "font-semibold" : ""}`}>{n(A)}</td>
      <td className={`${cellBase} ${bold ? "font-semibold" : ""}`}>{n(B)}</td>
      <td className={`${cellBase} font-semibold`}>
        {n(A + B)} <Delta v={A + B - base / 2} />
      </td>
    </>
  );

  const sectionRow = (label: string) => (
    <tr>
      <td colSpan={12} className="bg-gray-50 px-3 py-1.5 text-left text-xs font-bold tracking-wide text-gray-500">
        {label}
      </td>
    </tr>
  );

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-brand-50">
          <tr>
            <th rowSpan={2} className={`${th} text-left`}>교과(군)</th>
            <th rowSpan={2} className={`${th} text-left`}>교과</th>
            <th rowSpan={2} className={th}>
              기준시수
              <span className="block text-[10px] font-normal text-gray-400">증감 범위</span>
            </th>
            {years.map((y) => (
              <th key={y} colSpan={4} className={`${th} ${yearBorder} border-b border-brand-100 text-brand-700`}>
                {m.grades[y]}학년 <span className="font-normal text-gray-500">· {yearOf(semOf(y, 0))}학년도</span>
              </th>
            ))}
            <th rowSpan={2} className={`${th} ${yearBorder}`}>
              {m.grades[0]}~{m.grades[1]}학년군
              <span className="block text-[10px] font-normal text-gray-400">합계</span>
            </th>
          </tr>
          <tr>
            {years.map((y) => [
              <th key={`p${y}`} className={`${th} ${yearBorder} font-normal`}>배당</th>,
              <th key={`1${y}`} className={th}>1학기</th>,
              <th key={`2${y}`} className={th}>2학기</th>,
              <th key={`t${y}`} className={th}>계</th>,
            ])}
          </tr>
        </thead>
        <tbody>
          {sectionRow("교과")}
          {m.groups.flatMap((g) =>
            g.lines.map((ln, li) => {
              const last = li === g.lines.length - 1;
              const rowCls = last ? "border-b border-gray-200" : "";
              const isCourse = ln.kind === "course";
              const tint = isCourse ? "bg-orange-50" : "";
              return (
                <tr key={`${g.label}-${li}`} className={`${rowCls} hover:bg-gray-50/60`}>
                  {li === 0 &&
                    (g.merged ? (
                      <td colSpan={2} className={`${cellBase} text-left font-semibold`}>{g.label}</td>
                    ) : (
                      <td rowSpan={g.lines.length} className={`${cellBase} border-r border-gray-100 text-left font-semibold`}>
                        {g.label}
                      </td>
                    ))}
                  {!g.merged && (
                    <td className={`${cellBase} text-left ${tint} ${ln.kind === "placeholder" ? "text-gray-300" : ""}`}>
                      {ln.kind === "subject" ? (
                        ln.key
                      ) : ln.kind === "course" ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-orange-800">
                          <span className="rounded bg-orange-200 px-1 text-[10px] text-orange-900">학자시</span>
                          {ln.name}
                        </span>
                      ) : (
                        ln.name
                      )}
                    </td>
                  )}
                  {li === 0 && (
                    <td rowSpan={g.lines.length} className={cellBase}>
                      <span className="font-semibold">{n(g.base)}</span>
                      <span className="block text-[11px] text-gray-400">
                        {g.min}~{g.max}
                      </span>
                    </td>
                  )}
                  {years.map((y) => {
                    const A = semOf(y, 0);
                    const B = semOf(y, 1);
                    if (ln.kind === "subject") {
                      const q = ln.base / 4;
                      return [
                        <td key={`p${y}`} className={`${cellBase} ${yearBorder} text-gray-500`}>{ln.base / 2}</td>,
                        ...[A, B].map((s) => (
                          <td key={`h${s}`} className={cellBase}>
                            <span className="inline-flex items-center gap-1">
                              <input type="number" aria-label={`${ln.key} ${s}`} className={input} value={ln.hours[s]} onChange={(e) => setSubject(ln.key, s, num(e.target.value))} />
                              <Delta v={ln.hours[s] - q} />
                            </span>
                          </td>
                        )),
                        <td key={`t${y}`} className={`${cellBase} font-semibold`}>{ln.hours[A] + ln.hours[B]}</td>,
                      ];
                    }
                    if (ln.kind === "course") {
                      const at = (s: SemesterIndex) => (ln.semester === s ? ln.hours : 0);
                      return [
                        <td key={`p${y}`} className={`${cellBase} ${yearBorder} ${tint} text-gray-400`}>-</td>,
                        ...[A, B].map((s) => (
                          <td key={`h${s}`} className={`${cellBase} ${tint}`}>
                            {at(s) ? <span className="font-bold text-orange-700">+{at(s)}</span> : ""}
                          </td>
                        )),
                        <td key={`t${y}`} className={`${cellBase} ${tint} font-semibold`}>{at(A) + at(B) || ""}</td>,
                      ];
                    }
                    return [
                      <td key={`p${y}`} className={`${cellBase} ${yearBorder} text-gray-300`}>-</td>,
                      <td key={`a${y}`} className={cellBase} />,
                      <td key={`b${y}`} className={cellBase} />,
                      <td key={`t${y}`} className={cellBase} />,
                    ];
                  })}
                  {li === 0 && (
                    <td rowSpan={g.lines.length} className={`${cellBase} ${yearBorder}`}>
                      <GroupTotal value={g.planned} ok={g.ok} range={`${g.min}~${g.max}`} />
                    </td>
                  )}
                </tr>
              );
            }),
          )}
          <tr className="border-b-2 border-gray-200 bg-gray-50">
            <td colSpan={2} className={`${cellBase} text-left font-bold`}>교과 소계</td>
            <td className={`${cellBase} font-bold`}>{n(m.subtotal.base)}</td>
            {years.map((y) => (
              <SumYear key={y} base={m.subtotal.base} A={m.subjectSem[semOf(y, 0)]} B={m.subjectSem[semOf(y, 1)]} />
            ))}
            <td className={`${cellBase} ${yearBorder}`}>
              <GroupTotal value={m.subtotal.planned} ok={m.subtotal.ok} range="" />
            </td>
          </tr>
          {sectionRow("창의적 체험활동")}
          {m.creative.parts.map((p, k) => (
            <tr key={p.key} className={k === 2 ? "border-b border-gray-200" : ""}>
              <td colSpan={2} className={`${cellBase} text-left`}>{p.name}</td>
              {k === 0 && (
                <td rowSpan={3} className={cellBase}>
                  <span className="font-semibold">{n(m.creative.base)}</span>
                  <span className="block text-[11px] text-gray-400">
                    {m.creative.min}~{m.creative.max}
                  </span>
                </td>
              )}
              {years.map((y) => {
                const A = semOf(y, 0);
                const B = semOf(y, 1);
                return [
                  k === 0 ? (
                    <td key={`p${y}`} rowSpan={3} className={`${cellBase} ${yearBorder} text-gray-500`}>{m.creative.base / 2}</td>
                  ) : null,
                  ...[A, B].map((s) => (
                    <td key={`h${s}`} className={cellBase}>
                      <input type="number" aria-label={`${p.name} ${s}`} className={input} value={p.hours[s]} onChange={(e) => setPart(p.key, s, num(e.target.value))} />
                    </td>
                  )),
                  k === 0 ? (
                    <td key={`t${y}`} rowSpan={3} className={`${cellBase} font-semibold`}>
                      {m.creativeSem[A] + m.creativeSem[B]} <Delta v={m.creativeSem[A] + m.creativeSem[B] - m.creative.base / 2} />
                    </td>
                  ) : null,
                ];
              })}
              {k === 0 && (
                <td rowSpan={3} className={`${cellBase} ${yearBorder}`}>
                  <GroupTotal value={m.creative.planned} ok={m.creative.ok} range={`${m.creative.min}~${m.creative.max}`} />
                </td>
              )}
            </tr>
          ))}
          <tr className="bg-brand-50 font-bold">
            <td colSpan={2} className={`${cellBase} text-left font-bold`}>연간 수업 시간 수</td>
            <td className={`${cellBase} font-bold`}>{n(m.total.base)}</td>
            {years.map((y) => (
              <SumYear
                key={y}
                base={m.total.base}
                A={m.subjectSem[semOf(y, 0)] + m.creativeSem[semOf(y, 0)]}
                B={m.subjectSem[semOf(y, 1)] + m.creativeSem[semOf(y, 1)]}
              />
            ))}
            <td className={`${cellBase} ${yearBorder}`}>
              <GroupTotal value={m.total.planned} ok={m.total.ok} range={String(m.total.base)} />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
