"use client";

import { useEffect, useState } from "react";

interface Health {
  db: "not_configured" | "ok" | "error" | "memory";
  dbError?: string;
  authSecret: "ok" | "short" | "missing";
  adminEmails: number;
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
          ok={h ? h.db === "ok" : null}
          title="MongoDB 연결 (MONGODB_URI)"
          desc={
            h?.db === "ok"
              ? "연결 성공"
              : h?.db === "memory"
                ? "시험용 메모리 저장 중 — 서버가 다시 켜지면 모든 데이터가 사라집니다. 실제 운영에는 MongoDB Atlas 주소를 넣으세요."
                : h?.db === "error"
                  ? `연결 실패: ${h.dbError ?? ""} (주소·비밀번호·Atlas의 Network Access 설정을 확인하세요)`
                  : "아직 없음 → 로그인·저장·관리자 기능이 꺼져 있습니다. (설계와 문서 내려받기는 사용 가능)"
          }
        />
        <Row
          ok={h ? h.authSecret === "ok" : null}
          title="로그인 비밀키 (AUTH_SECRET)"
          desc={h?.authSecret === "ok" ? "설정됨" : h?.authSecret === "short" ? "너무 짧습니다. 32자 이상 무작위 문자열을 넣으세요." : "아직 없음 → 32자 이상 무작위 문자열을 넣으세요."}
        />
        <Row
          ok={h ? h.adminEmails > 0 : null}
          title="관리자 이메일 (ADMIN_EMAILS)"
          desc={h && h.adminEmails > 0 ? `${h.adminEmails}개 설정됨 — 이 이메일로 가입하면 바로 관리자가 됩니다.` : "아직 없음 → 관리자가 될 이메일을 넣으세요. (여러 개는 쉼표로 구분)"}
        />
      </ul>
    </div>
  );
}
