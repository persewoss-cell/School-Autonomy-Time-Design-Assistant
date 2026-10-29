import "server-only";

/** 환경 변수는 이 파일에서만 읽는다. 값은 .env(로컬) 또는 Vercel 환경 변수에 넣는다. */
export const env = {
  mongodbUri: process.env.MONGODB_URI?.trim() || "",
  mongodbDb: process.env.MONGODB_DB?.trim() || "school_autonomy",
};
