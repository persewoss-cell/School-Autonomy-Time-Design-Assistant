"use client";

import { formModel, signed, vertical } from "@/domain/allocationForm";
import { withCreativeParts, type AllocationInput, type CreativePart, type FourSemesters, type SemesterIndex } from "@/validation/allocation";

/**
 * 시수 점검 편성표 — 학교 '( )학년 교육과정 편성표' 양식 모양 그대로, 편성 시수 칸에 바로 입력.
 * 글자는 한 줄로(세로 글자 칸 제외), 1주 수업시간 칸은 두지 않는다.
 */

const td = "border border-gray-400 px-1 py-0.5 text-center whitespace-nowrap";
const th = `${td} bg-[#dce3ee] font-semibold`;
const blue = "text-[#1f3fbf]";
const red = "text-red-600";
const course = "bg-[#fce4d6]";
const input =
  "w-10 rounded-sm border border-gray-300 bg-white px-0.5 py-0.5 text-center text-xs [appearance:textfield] focus:border-brand-500 focus:outline-none [&::-webkit-inner-spin-button]:appearance-none";
const num = (v: string) => Math.max(0, Math.floor(Number(v) || 0));
const n = (v: number) => v.toLocaleString("ko-KR");

function Vertical({ text }: { text: string }) {
  return (
    <span className="inline-flex flex-col items-center leading-tight">
      {vertical(text).map((c, i) => (
        <span key={i}>{c}</span>
      ))}
    </span>
  );
}

function Stack({ lines, className = "" }: { lines: string[]; className?: string }) {
  return (
    <span className={`inline-flex flex-col items-center leading-tight ${className}`}>
      {lines.map((l, i) => (
        <span key={i}>{l}</span>
      ))}
    </span>
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
  const subjectLineCount = m.groups.reduce((t, g) => t + g.lines.length, 0);
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

  /** 소계·연간 줄의 학년별 칸 */
  const sumCells = (base: number, at: (s: SemesterIndex) => number, showDelta = true) =>
    years.flatMap((y) => {
      const A = at(semOf(y, 0));
      const B = at(semOf(y, 1));
      return [
        <td key={`b${y}`} className={`${td} font-bold`}>{n(base / 2)}</td>,
        <td key={`d${y}`} className={`${td} font-bold ${red}`}>{showDelta ? signed(A + B - base / 2) : ""}</td>,
        <td key={`a${y}`} className={`${td} font-bold`}>{n(A)}</td>,
        <td key={`e${y}`} className={td} />,
        <td key={`c${y}`} className={`${td} font-bold`}>{n(B)}</td>,
        <td key={`t${y}`} className={`${td} font-bold`}>{n(A + B)}</td>,
      ];
    });

  let firstLine = true;
  return (
    <div className="overflow-x-auto">
      <table className="mx-auto border-collapse text-xs">
        <thead>
          <tr>
            <th rowSpan={3} colSpan={3} className={`${th} relative h-16 min-w-[120px]`}>
              <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100" aria-hidden>
                <line x1="0" y1="0" x2="100" y2="100" stroke="#6b7280" strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
              </svg>
              <span className="absolute right-1 top-1">학년</span>
              <span className="absolute bottom-1 left-1">구분</span>
            </th>
            <th rowSpan={3} className={th}><Stack lines={["기준", "시수"]} /></th>
            <th rowSpan={3} className={th}><Stack lines={["증감", "범위"]} /></th>
            {years.map((y) => (
              <th key={y} colSpan={6} className={`${th} ${red}`}>
                {m.grades[y]}학년({yearOf(semOf(y, 0))}학년도)
              </th>
            ))}
            <th rowSpan={3} className={th}><Stack lines={[`${m.grades[0]}~${m.grades[1]}`, "학년군", "시수", "합계"]} /></th>
          </tr>
          <tr>
            {years.map((y) => [
              <th key={`p${y}`} rowSpan={2} className={th}><Stack lines={["학년", "시수", "배당"]} /></th>,
              <th key={`1${y}`} colSpan={2} className={th}>1학기</th>,
              <th key={`2${y}`} colSpan={2} className={th}>2학기</th>,
              <th key={`t${y}`} rowSpan={2} className={th}>계</th>,
            ])}
          </tr>
          <tr>
            {years.flatMap((y) =>
              [0, 1].flatMap((k) => [
                <th key={`d${y}${k}`} className={th}><Stack lines={["증감", "시수"]} /></th>,
                <th key={`e${y}${k}`} className={th}><Stack lines={["편성", "시수"]} /></th>,
              ]),
            )}
          </tr>
        </thead>
        <tbody>
          {m.groups.flatMap((g) =>
            g.lines.map((ln, li) => {
              const cells = [];
              if (firstLine) {
                cells.push(
                  <td key="kyo" rowSpan={subjectLineCount + 1} className={`${td} font-bold`}>
                    <Vertical text="교과" />
                  </td>,
                );
                firstLine = false;
              }
              if (li === 0) {
                cells.push(
                  g.merged ? (
                    <td key="g" colSpan={2} className={`${td} font-semibold`}>{vertical(g.label).join(" ")}</td>
                  ) : (
                    <td key="g" rowSpan={g.lines.length} className={`${td} font-semibold`}>
                      <Vertical text={g.label} />
                    </td>
                  ),
                );
              }
              if (!g.merged) {
                cells.push(
                  <td key="s" className={`${td} ${ln.kind === "course" ? `${course} font-bold outline outline-2 -outline-offset-2 outline-red-500` : ""}`}>
                    {ln.kind === "subject" ? ln.key : ln.name}
                  </td>,
                );
              }
              if (li === 0) {
                cells.push(
                  <td key="b" rowSpan={g.lines.length} className={`${td} ${blue}`}>
                    <Stack lines={[n(g.base), `(${g.noReduction ? "+" : "±"}${g.delta})`]} />
                  </td>,
                  <td key="r" rowSpan={g.lines.length} className={`${td} ${blue}`}>
                    <Stack lines={[String(g.min), "~", String(g.max)]} />
                  </td>,
                );
              }
              for (const y of years) {
                const A = semOf(y, 0);
                const B = semOf(y, 1);
                if (ln.kind === "subject") {
                  const q = ln.base / 4;
                  cells.push(
                    <td key={`p${y}`} className={td}>{ln.base / 2}</td>,
                    <td key={`dA${y}`} className={`${td} ${red}`}>{signed(ln.hours[A] - q)}</td>,
                    <td key={`hA${y}`} className={td}>
                      <input type="number" className={input} value={ln.hours[A]} onChange={(e) => setSubject(ln.key, A, num(e.target.value))} />
                    </td>,
                    <td key={`dB${y}`} className={`${td} ${red}`}>{signed(ln.hours[B] - q)}</td>,
                    <td key={`hB${y}`} className={td}>
                      <input type="number" className={input} value={ln.hours[B]} onChange={(e) => setSubject(ln.key, B, num(e.target.value))} />
                    </td>,
                    <td key={`t${y}`} className={td}>{ln.hours[A] + ln.hours[B]}</td>,
                  );
                } else if (ln.kind === "course") {
                  const at = (s: SemesterIndex) => (ln.semester === s ? ln.hours : 0);
                  cells.push(
                    <td key={`p${y}`} className={`${td} ${course}`}>-</td>,
                    <td key={`dA${y}`} className={`${td} ${course} font-bold ${red}`}>{signed(at(A))}</td>,
                    <td key={`hA${y}`} className={`${td} ${course}`}>{at(A) || ""}</td>,
                    <td key={`dB${y}`} className={`${td} ${course} font-bold ${red}`}>{signed(at(B))}</td>,
                    <td key={`hB${y}`} className={`${td} ${course}`}>{at(B) || ""}</td>,
                    <td key={`t${y}`} className={`${td} ${course}`}>{at(A) + at(B) || ""}</td>,
                  );
                } else {
                  cells.push(
                    <td key={`p${y}`} className={td}>{y === 0 ? "-" : ""}</td>,
                    ...[0, 1, 2, 3, 4].map((k) => <td key={`x${y}${k}`} className={td} />),
                  );
                }
              }
              if (li === 0) {
                cells.push(
                  <td
                    key="sum"
                    rowSpan={g.lines.length}
                    title={g.ok ? "이상없음" : `증감 범위 ${g.min}~${g.max} 밖`}
                    className={`${td} font-bold ${g.ok ? blue : "bg-red-100 text-red-700"}`}
                  >
                    {n(g.planned)}
                  </td>,
                );
              }
              return <tr key={`${g.label}-${li}`}>{cells}</tr>;
            }),
          )}
          <tr className="bg-gray-50">
            <td colSpan={2} className={`${td} font-bold`}>소&nbsp;&nbsp;&nbsp;계</td>
            <td className={`${td} font-bold ${blue}`}>{n(m.subtotal.base)}</td>
            <td className={td} />
            {sumCells(m.subtotal.base, (s) => m.subjectSem[s])}
            <td className={`${td} font-bold ${m.subtotal.ok ? blue : "bg-red-100 text-red-700"}`}>{n(m.subtotal.planned)}</td>
          </tr>
          {m.creative.parts.map((p, k) => (
            <tr key={p.key}>
              {k === 0 && (
                <td rowSpan={4} className={`${td} font-bold`}>
                  <Vertical text="창의적체험활동" />
                </td>
              )}
              <td colSpan={2} className={td}>{p.name}</td>
              {k === 0 && (
                <>
                  <td rowSpan={3} className={`${td} ${blue}`}>
                    <Stack lines={[n(m.creative.base), `(±${m.creative.delta})`]} />
                  </td>
                  <td rowSpan={3} className={`${td} ${blue}`}>
                    <Stack lines={[String(m.creative.min), "~", String(m.creative.max)]} />
                  </td>
                </>
              )}
              {years.flatMap((y) => {
                const A = semOf(y, 0);
                const B = semOf(y, 1);
                const q = m.creative.base / 4;
                return [
                  k === 0 && <td key={`p${y}`} rowSpan={3} className={td}>{m.creative.base / 2}</td>,
                  k === 0 && <td key={`dA${y}`} rowSpan={3} className={`${td} ${red}`}>{signed(m.creativeSem[A] - q)}</td>,
                  <td key={`hA${y}`} className={td}>
                    <input type="number" className={input} value={p.hours[A]} onChange={(e) => setPart(p.key, A, num(e.target.value))} />
                  </td>,
                  k === 0 && <td key={`dB${y}`} rowSpan={3} className={`${td} ${red}`}>{signed(m.creativeSem[B] - q)}</td>,
                  <td key={`hB${y}`} className={td}>
                    <input type="number" className={input} value={p.hours[B]} onChange={(e) => setPart(p.key, B, num(e.target.value))} />
                  </td>,
                  k === 0 && <td key={`t${y}`} rowSpan={3} className={td}>{m.creativeSem[A] + m.creativeSem[B]}</td>,
                ].filter(Boolean);
              })}
              {k === 0 && (
                <td rowSpan={3} className={`${td} font-bold ${m.creative.ok ? blue : "bg-red-100 text-red-700"}`}>
                  {n(m.creative.planned)}
                </td>
              )}
            </tr>
          ))}
          <tr className="bg-gray-50">
            <td colSpan={2} className={`${td} font-bold`}>소&nbsp;&nbsp;&nbsp;계</td>
            <td className={`${td} font-bold ${blue}`}>{n(m.creative.base)}</td>
            <td className={td} />
            {sumCells(m.creative.base, (s) => m.creativeSem[s])}
            <td className={`${td} font-bold ${m.creative.ok ? blue : "bg-red-100 text-red-700"}`}>{n(m.creative.planned)}</td>
          </tr>
          <tr>
            <td colSpan={3} className={`${td} font-bold`}>연간수업시간수</td>
            <td className={`${td} font-bold ${blue}`}>{n(m.total.base)}</td>
            <td className={td} />
            {sumCells(m.total.base, (s) => m.subjectSem[s] + m.creativeSem[s], false)}
            <td className={`${td} font-bold ${m.total.ok ? blue : "bg-red-100 text-red-700"}`}>{n(m.total.planned)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
