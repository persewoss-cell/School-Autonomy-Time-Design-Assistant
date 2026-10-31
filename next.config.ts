import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // '광양중동초 자료 넣기'가 읽는 예시안 PDF를 배포 파일에 포함
  outputFileTracingIncludes: { "/api/admin/seed": ["./data/seed/examples/*.pdf"] },
};

export default nextConfig;
