"use client";

import { useEffect, useState } from "react";

interface Health {
  ai: "demo" | "configured";
  model: string;
  db: "not_configured" | "ok" | "error";
  dbError?: string;
}

function Row({ ok, title, desc }: { ok: boolean | null; title: string; desc: string }) {
  const badge = ok === null ? "bg-gray-100 text-gray-500" : ok ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700";
  return (
    <li className="flex items-start gap-3 rounded-xl bg-white p-4 shadow-sm">
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${badge}`}>
        {ok === null ? "확인 중" : ok ? "정상" : "설정 필요"}
      </span>
      <div>
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-gray-600">{desc}</p>
      </div>
    </li>
  );
}

export default function StatusPage() {
  const [h, setH] = useState<Health | null>(null);
  useEffect(() => {
    fetch("/api/health").then((r) => r.json()).then(setH).catch(() => setH(null));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">설정 확인</h1>
      <p className="text-gray-600">서버에 환경 변수가 제대로 들어갔는지 확인하는 화면입니다.</p>
      <ul className="space-y-3">
        <Row
          ok={h ? h.ai === "configured" : null}
          title="Claude API 키 (ANTHROPIC_API_KEY)"
          desc={
            h?.ai === "configured"
              ? `설정됨 · 사용 모델: ${h.model}`
              : "아직 없음 → 체험 모드로 예시 3안을 보여 줍니다. 키를 넣으면 실제 AI가 추천합니다."
          }
        />
        <Row
          ok={h ? h.db === "ok" : null}
          title="MongoDB 연결 (MONGODB_URI)"
          desc={
            h?.db === "ok"
              ? "연결 성공"
              : h?.db === "error"
                ? `연결 실패: ${h.dbError ?? ""} (주소·비밀번호·Atlas의 Network Access 설정을 확인하세요)`
                : "아직 없음 → 저장 기능은 5단계에서 연결합니다."
          }
        />
      </ul>
    </div>
  );
}
