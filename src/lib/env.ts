import "server-only";

/** 환경 변수는 이 파일에서만 읽는다. 값은 .env(로컬) 또는 Vercel 환경 변수에 넣는다. */
export const env = {
  mongodbUri: process.env.MONGODB_URI?.trim() || "",
  mongodbDb: process.env.MONGODB_DB?.trim() || "school_autonomy",
  /** 로그인 세션 서명 비밀키 (32자 이상 무작위 문자열) */
  authSecret: process.env.AUTH_SECRET?.trim() || "",
  /** 가입하면 바로 관리자가 되는 학교 (정식 명칭, 쉼표로 구분) */
  adminSchools: (process.env.ADMIN_SCHOOLS ?? "")
    .split(",")
    .map((s) => s.replace(/\s+/g, ""))
    .filter(Boolean),
};

/** 저장·로그인 기능을 쓸 수 있는지: DB 주소와 세션 비밀키가 모두 있어야 함 */
export const isAccountEnabled = () => env.mongodbUri !== "" && env.authSecret.length >= 32;
