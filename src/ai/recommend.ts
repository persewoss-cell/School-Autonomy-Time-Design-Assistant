import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { env, isDemoMode } from "@/lib/env";
import {
  recommendResponseSchema,
  type BasicInfo,
  type Plan,
  type TopicInput,
} from "@/domain/types";
import { RECOMMEND_SYSTEM, buildRecommendUserPrompt, recommendJsonSchema } from "./recommendPrompt";
import { makeDemoPlans } from "./demoPlans";

export interface RecommendResult {
  plans: Plan[];
  demo: boolean;
  model: string;
  usage?: { inputTokens: number; outputTokens: number };
}

export class RecommendError extends Error {}

/** 단원 지도계획 3안 추천. API 키가 없으면 체험 모드 예시를 돌려준다. */
export async function recommendPlans(basic: BasicInfo, input: TopicInput): Promise<RecommendResult> {
  if (isDemoMode()) {
    return { plans: makeDemoPlans(basic, input), demo: true, model: "demo" };
  }

  const client = new Anthropic({ apiKey: env.anthropicApiKey });
  let message;
  try {
    // 응답이 길 수 있어 스트리밍으로 받고 마지막에 한 번에 모은다.
    const stream = client.beta.messages.stream({
      model: env.claudeModel,
      max_tokens: 32000,
      betas: ["server-side-fallback-2026-07-01"],
      // 안전 분류기가 요청을 거절하면 서버에서 다른 모델로 자동 재시도
      fallbacks: "default",
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: recommendJsonSchema },
      },
      system: RECOMMEND_SYSTEM,
      messages: [{ role: "user", content: buildRecommendUserPrompt(basic, input) }],
    });
    message = await stream.finalMessage();
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) {
      throw new RecommendError("Claude API 키가 올바르지 않습니다. 관리자에게 API 키 설정을 확인해 달라고 해 주세요.");
    }
    if (e instanceof Anthropic.RateLimitError) {
      throw new RecommendError("AI 요청이 많아 잠시 쉬어야 합니다. 1분 뒤에 다시 시도해 주세요.");
    }
    if (e instanceof Anthropic.APIConnectionError) {
      throw new RecommendError("AI 서버에 연결하지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
    }
    if (e instanceof Anthropic.APIError) {
      throw new RecommendError(`AI 요청 중 오류가 났습니다. (${e.status ?? "알 수 없음"})`);
    }
    throw e;
  }

  if (message.stop_reason === "refusal") {
    throw new RecommendError("AI가 이 요청에 답하지 않았습니다. 주제나 내용 표현을 바꿔 다시 시도해 주세요.");
  }
  if (message.stop_reason === "max_tokens") {
    throw new RecommendError("AI 응답이 너무 길어 중간에 끊겼습니다. 다시 시도해 주세요.");
  }

  const text = message.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new RecommendError("AI 응답을 읽지 못했습니다. 다시 시도해 주세요.");
  }
  const result = recommendResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new RecommendError("AI 응답 형식이 맞지 않습니다. 다시 시도해 주세요.");
  }

  return {
    plans: result.data.plans,
    demo: false,
    model: message.model,
    usage: { inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens },
  };
}
