import "server-only";

/** 환경 변수는 이 파일에서만 읽는다. 값은 .env(로컬) 또는 Vercel 환경 변수에 넣는다. */
export const env = {
  anthropicApiKey: process.env.ANTHROPIC_API_KEY?.trim() || "",
  claudeModel: process.env.CLAUDE_MODEL?.trim() || "claude-opus-5-5",
  mongodbUri: process.env.MONGODB_URI?.trim() || "",
  mongodbDb: process.env.MONGODB_DB?.trim() || "school_autonomy",
};

/** API 키가 없으면 체험 모드(예시 데이터)로 동작한다. */
export const isDemoMode = () => env.anthropicApiKey === "";
