import { NextResponse } from "next/server";
import { z } from "zod";
import { basicInfoSchema, topicInputSchema } from "@/domain/types";
import { RecommendError, recommendPlans } from "@/ai/recommend";

export const maxDuration = 300; // AI 응답이 오래 걸릴 수 있음 (초)

const bodySchema = z.object({ basic: basicInfoSchema, input: topicInputSchema });

export async function POST(request: Request) {
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json(
      { error: "입력값을 다시 확인해 주세요.", details: body.error.issues.map((i) => i.message) },
      { status: 400 },
    );
  }
  try {
    const result = await recommendPlans(body.data.basic, body.data.input);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof RecommendError) {
      return NextResponse.json({ error: e.message }, { status: 502 });
    }
    console.error("recommend failed", e);
    return NextResponse.json({ error: "알 수 없는 오류가 났습니다." }, { status: 500 });
  }
}
