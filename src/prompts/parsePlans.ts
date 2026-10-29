import { z } from "zod";
import { planSchema, type Plan } from "@/domain/types";

export type ParseResult = { ok: true; plans: Plan[]; notes: string[] } | { ok: false; error: string };

// AI마다 형식이 조금씩 달라서, 숫자 문자열·빠진 칸 정도는 너그럽게 받아 준다.
const looseLesson = z.object({
  hours: z.coerce.number().int().min(1).max(10),
  topic: z.string().trim().min(1),
  goal: z.string().trim().default(""),
  activities: z
    .union([z.array(z.string()), z.string()])
    .transform((v) => (Array.isArray(v) ? v : v.split("\n")))
    .transform((v) => v.map((s) => s.trim().replace(/^[-·•]\s*/, "")).filter(Boolean))
    .default([]),
  assessment: z.string().nullish().transform((v) => v?.trim() ?? ""),
  note: z.string().nullish().transform((v) => v?.trim() ?? ""),
});
const loosePlan = z.object({
  title: z.string().trim().min(1),
  concept: z.string().trim().default(""),
  units: z.array(z.object({ unitName: z.string().trim().min(1), lessons: z.array(looseLesson).min(1) })).min(1),
});

/** 답에서 JSON 부분만 꺼낸다: ```json 블록이 있으면 그 안, 없으면 첫 { ~ 마지막 } */
export function extractJson(text: string): string | null {
  const fence = text.match(/```(?:json|JSON)?\s*([\s\S]*?)```/);
  const body = fence ? fence[1] : text;
  const start = body.search(/[[{]/);
  const end = Math.max(body.lastIndexOf("}"), body.lastIndexOf("]"));
  if (start === -1 || end <= start) return null;
  return body
    .slice(start, end + 1)
    .replace(/[“”]/g, '"') // 일부 AI·워드프로세서가 바꾸는 둥근 따옴표
    .replace(/,\s*([}\]])/g, "$1"); // 끝에 남은 쉼표
}

function fieldName(path: PropertyKey[]): string {
  const names: Record<string, string> = {
    plans: "안",
    units: "단원",
    lessons: "차시",
    hours: "차시 수(hours)",
    topic: "학습주제(topic)",
    title: "안 이름(title)",
    unitName: "단원명(unitName)",
  };
  const parts: string[] = [];
  for (let i = 0; i < path.length; i++) {
    const p = path[i];
    if (typeof p === "number") parts.push(`${p + 1}번째`);
    else parts.push(names[String(p)] ?? String(p));
  }
  return parts.join(" ");
}

export function parsePlans(text: string): ParseResult {
  if (!text.trim()) return { ok: false, error: "붙여 넣은 내용이 없습니다." };
  const json = extractJson(text);
  if (!json) {
    return {
      ok: false,
      error: /[[{]/.test(text)
        ? "JSON이 중간에 끊긴 것 같습니다. 답 전체를 복사했는지 확인하세요."
        : "답에서 JSON 코드 블록을 찾지 못했습니다.",
    };
  }

  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { ok: false, error: "JSON 형식이 깨져 있습니다. (답이 중간에 끊겼거나 괄호·따옴표가 빠졌을 수 있습니다)" };
  }
  const raw = Array.isArray(data) ? data : (data as { plans?: unknown })?.plans;
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, error: "답에 plans(안 목록)가 없습니다." };
  }

  const parsed = z.array(loosePlan).safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: `${fieldName(issue.path)} 칸이 비었거나 형식이 맞지 않습니다.` };
  }

  const notes: string[] = [];
  let plans = parsed.data;
  if (plans.length > 3) {
    notes.push(`AI가 ${plans.length}개 안을 주어 앞의 3개만 가져왔습니다.`);
    plans = plans.slice(0, 3);
  } else if (plans.length < 3) {
    notes.push(`AI가 ${plans.length}개 안만 주었습니다. 더 필요하면 AI에게 다시 요청하세요.`);
  }

  // 활동이 빈 차시는 학습주제로 채워 화면 편집이 가능하게 한다
  const result = plans.map((p) =>
    planSchema.parse({
      ...p,
      concept: p.concept || p.title,
      units: p.units.map((u) => ({
        ...u,
        lessons: u.lessons.map((l) => ({
          ...l,
          goal: l.goal || `${l.topic}을(를) 해 봅시다.`,
          activities: l.activities.length ? l.activities : [l.topic],
        })),
      })),
    }),
  );
  return { ok: true, plans: result, notes };
}
