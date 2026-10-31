"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  DESIGN_TYPES,
  GRADES,
  OPENING_TYPES,
  OPERATION_MODES,
  SUBJECT_GROUPS,
  basicInfoSchema,
  type BasicInfo,
  type Grade,
} from "@/domain/types";
import { checkBasicHours, checkSemesterBudget, semesterHours } from "@/validation/hours";
import { bandInfo, bandOfGrade } from "@/validation/allocation";
import { findSameName, sameNameMessage } from "@/validation/names";

/** 에듀넷 티-클리어 '교육감 승인 과목' 목록 (교사 로그인해야 보임) */
const APPROVED_SUBJECTS_URL = "https://www.edunet.net/sprApprSbjct/list/11";
import { Card, Field, IssueList, NavButtons, inputClass } from "../ui";
import { useSavedDesigns } from "./useSavedDesigns";

export function BasicStep({
  value,
  designId,
  schoolYear,
  onBack,
  onNext,
}: {
  value: BasicInfo;
  /** 지금 설계의 저장 id (같은 학기 합계에서 뺌) */
  designId?: string;
  schoolYear: string;
  onBack: () => void;
  onNext: (b: BasicInfo, schoolYear: string) => void;
}) {
  const [b, setB] = useState<BasicInfo>(value);
  const [year, setYear] = useState(schoolYear || "2027");
  const saved = useSavedDesigns();
  const others = saved
    .filter((d) => d.id !== designId && d.grade === b.grade && d.semester === b.semester && (d.schoolYear || "2027") === year)
    .map((d) => ({ name: `${d.name} (${d.type === "subject" ? "과목" : "활동"})`, hours: d.hours ?? 0 }));
  const [errors, setErrors] = useState<string[]>([]);
  const kind = DESIGN_TYPES[b.type];
  const set = <K extends keyof BasicInfo>(k: K, v: BasicInfo[K]) => setB((s) => ({ ...s, [k]: v }));

  // 같은 학기에 다른 설계가 있으면 '혼자 운영한다면 …' 안내 대신 학기 합계로 알려 준다
  // 교내 이름 중복: 같은 학년도의 다른 과목·활동과 같은 이름 불가 (띄어쓰기 무시). '다음'을 누른 뒤부터 칸 아래에 표시
  const sameName = findSameName(
    b.name,
    saved.filter((d) => d.id !== designId && (d.schoolYear || "2027") === year),
  );
  const [nameTried, setNameTried] = useState(false);
  const issues = [...checkSemesterBudget(b, others), ...checkBasicHours(b).filter((i) => !(others.length && i.level === "warning"))];
  const submit = () => {
    const r = basicInfoSchema.safeParse(b);
    if (!r.success) return setErrors(r.error.issues.map((i) => i.message));
    if (!/^\d{4}$/.test(year)) return setErrors(["운영 학년도를 2027처럼 네 자리 숫자로 적어 주세요."]);
    if (sameName) {
      setNameTried(true);
      setErrors([]);
      alert(`입력에 오류가 있어요. ${kind}명 아래 빨간 안내를 확인해 고쳐 주세요.`);
      document.getElementById("design-name")?.focus();
      return;
    }
    if (issues.some((i) => i.level === "error")) return setErrors(["시수 점검의 오류를 먼저 고쳐 주세요."]);
    setErrors([]);
    onNext(r.data, year);
  };

  return (
    <Card className="space-y-5">
      <h1 className="text-xl font-bold">기본 정보 ({kind})</h1>

      <div className="space-y-1">
        <label htmlFor="design-name" className="text-sm font-semibold">
          {kind}명
        </label>
        <div className="flex gap-2">
          <input
            id="design-name"
            className={`${inputClass} ${nameTried && sameName ? "border-red-400" : ""}`}
            value={b.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="예: 지구마을 첫걸음"
          />
          {b.type === "subject" && (
            <a
              href={APPROVED_SUBJECTS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex shrink-0 items-center rounded-lg border border-brand-500 px-3 text-sm font-semibold text-brand-700 hover:bg-brand-50"
            >
              교육감 승인 과목 확인 ↗
            </a>
          )}
        </div>
        {nameTried && sameName ? (
          <p className="text-xs font-semibold text-red-600">⚠ {sameNameMessage(sameName)}</p>
        ) : (
          <p className="text-xs text-gray-500">
            {b.type === "activity"
              ? "교내 같은 학년도의 다른 과목·활동과 같은 이름은 쓸 수 없어요 (학년이 달라도, 띄어쓰기 무시). 예: 자전거 하이킹3, 자전거 하이킹4"
              : "교내 같은 학년도의 다른 과목·활동과 겹치면 안 되고, 전국 과목명과도 겹치면 안 돼요. 버튼 → 에듀넷 티-클리어(교사 로그인 필요)에서 검색해 확인하세요."}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="운영 학년도" hint="다음 해에는 설계 현황에서 복제해 고쳐 써요">
          <input className={inputClass} inputMode="numeric" maxLength={4} value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, ""))} />
        </Field>
        <Field label="학년">
          <select
            className={inputClass}
            value={b.grade}
            onChange={(e) => {
              const grade = Number(e.target.value) as Grade;
              // 학년을 바꾸면 그 학년의 한 학기 시수로 자동 변경
              setB((s) => ({
                ...s,
                grade,
                hours: semesterHours(grade),
                // 3~4학년에는 실과가 없으므로 다른 교과로 바꿈
                subjectGroup: grade <= 4 && s.subjectGroup === "실과" ? "과학" : s.subjectGroup,
              }));
            }}
          >
            {GRADES.map((g) => (
              <option key={g} value={g}>{g}학년</option>
            ))}
          </select>
        </Field>
        <Field label="학기" hint="학기 단위로만 운영 (1·2학기 나눠 운영 불가)">
          <select className={inputClass} value={b.semester} onChange={(e) => set("semester", Number(e.target.value) as 1 | 2)}>
            <option value={1}>1학기</option>
            <option value={2}>2학기</option>
          </select>
        </Field>
        <Field label="운영 시수" hint={`${b.grade}학년 한 학기 기준 ${semesterHours(b.grade)}시간 · 최소 10시간`}>
          <input
            type="number"
            min={1}
            max={40}
            className={inputClass}
            value={b.hours}
            onChange={(e) => set("hours", Number(e.target.value) || 0)}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="편성 교과(군)" hint="이 교과 시수 안에 편성돼요">
          <select className={inputClass} value={b.subjectGroup} onChange={(e) => set("subjectGroup", e.target.value)}>
            {SUBJECT_GROUPS.filter((s) => bandInfo(bandOfGrade(b.grade)).subjects.some((x) => x.key === s)).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="개설 형태">
          <select className={inputClass} value={b.openingType} onChange={(e) => set("openingType", e.target.value as BasicInfo["openingType"])}>
            {OPENING_TYPES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="운영 방식" hint="지속형: 학기 내 정기 · 집중형: 특정 주/월 · 혼합형">
          <select className={inputClass} value={b.operationMode} onChange={(e) => set("operationMode", e.target.value as BasicInfo["operationMode"])}>
            {OPERATION_MODES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </Field>
      </div>

      {["체육", "음악", "미술"].includes(b.subjectGroup) && (
        <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
          참고: 체육·음악·미술은 기준 시수보다 줄일 수 없어요. 학교자율시간을 포함한 교과 총 시수가 기준 시수 이상인지 확인하세요.
        </p>
      )}

      <div>
        <p className="mb-2 text-sm font-semibold">시수 점검</p>
        {others.length > 0 && (
          <p className="mb-2 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
            우리 학교 {year}학년도 {b.grade}학년 {b.semester}학기에 이미 만든 설계: {others.map((o) => `${o.name} ${o.hours}차시`).join(", ")} → 합계{" "}
            {others.reduce((s, o) => s + o.hours, 0)}차시 / {semesterHours(b.grade)}차시
          </p>
        )}
        <IssueList issues={issues} />
      </div>

      {errors.length > 0 && (
        <ul className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {errors.map((e) => (
            <li key={e}>• {e}</li>
          ))}
        </ul>
      )}
      <NavButtons onBack={onBack} onNext={submit} />
    </Card>
  );
}
