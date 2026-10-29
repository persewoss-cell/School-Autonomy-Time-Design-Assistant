"use client";

import { useState } from "react";
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
import { checkBasicHours, semesterHours } from "@/validation/hours";
import { bandInfo, bandOfGrade } from "@/validation/allocation";
import { Card, Field, IssueList, NavButtons, inputClass } from "../ui";

export function BasicStep({
  value,
  onBack,
  onNext,
}: {
  value: BasicInfo;
  onBack: () => void;
  onNext: (b: BasicInfo) => void;
}) {
  const [b, setB] = useState<BasicInfo>(value);
  const [errors, setErrors] = useState<string[]>([]);
  const kind = DESIGN_TYPES[b.type];
  const set = <K extends keyof BasicInfo>(k: K, v: BasicInfo[K]) => setB((s) => ({ ...s, [k]: v }));

  const issues = checkBasicHours(b);
  const submit = () => {
    const r = basicInfoSchema.safeParse(b);
    if (!r.success) return setErrors(r.error.issues.map((i) => i.message));
    if (issues.some((i) => i.level === "error")) return setErrors(["운영 시수 오류를 먼저 고쳐 주세요."]);
    setErrors([]);
    onNext(r.data);
  };

  return (
    <Card className="space-y-5">
      <h1 className="text-xl font-bold">기본 정보 ({kind})</h1>

      <Field
        label={`${kind}명`}
        hint={
          b.type === "activity"
            ? "같은 학교·같은 학년도에 같은 활동명은 쓸 수 없어요. (예: 자전거 하이킹3, 자전거 하이킹4처럼 구분)"
            : "전국 초·중·고 과목명과 겹치면 안 돼요. 에듀넷 티클리어 '교육감 승인 과목'에서 미리 확인하세요."
        }
      >
        <input className={inputClass} value={b.name} onChange={(e) => set("name", e.target.value)} placeholder="예: 지구마을 첫걸음" />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
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
