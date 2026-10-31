import { LoginGateLink } from "@/components/LoginGate";

const steps = [
  ["기본 정보", "학년·학기를 고르면 시수가 자동으로 채워져요"],
  ["주제와 내용", "주제, 필수 내용, 원하는 활동을 적어요"],
  ["AI에게 묻기", "프롬프트를 복사해 내 AI에 붙여 넣고, 답을 다시 붙여 넣어요"],
  ["고르고 고치기", "마음에 드는 안을 골라 차시를 고쳐요"],
  ["자동 점검", "시수·양식이 지침에 맞는지 코드가 검사해요"],
  ["내려받기", "한글에서 열리는 .docx 파일로 내려받아요"],
];

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="rounded-2xl bg-white p-8 shadow-sm">
        <p className="text-lg font-bold text-brand-600">학교자율시간</p>
        <h1 className="mt-2 text-3xl font-bold">과목·활동 설계, 단계별로 함께 해요</h1>
        <p className="mt-3 text-gray-600">
          내 AI에 붙여 넣을 프롬프트를 만들고, AI 답을 지침대로 점검해 한글 문서로 완성해요.
        </p>
        <LoginGateLink
          href="/designs/new"
          className="mt-6 inline-block rounded-lg bg-brand-600 px-5 py-3 font-semibold text-white hover:bg-brand-700"
        >
          새 설계 시작하기
        </LoginGateLink>
        <LoginGateLink
          href="/hours"
          className="ml-2 mt-6 inline-block rounded-lg border border-brand-500 px-5 py-3 font-semibold text-brand-700 hover:bg-brand-50"
        >
          시수 편성 점검하기
        </LoginGateLink>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">진행 순서</h2>
        <ol className="grid gap-3 sm:grid-cols-3">
          {steps.map(([title, desc], i) => (
            <li key={title} className="rounded-xl bg-white p-4 shadow-sm">
              <span className="text-xs font-bold text-brand-600">STEP {i + 1}</span>
              <p className="font-semibold">{title}</p>
              <p className="text-sm text-gray-500">{desc}</p>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">과목과 활동, 무엇이 다른가요?</h2>
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-brand-50 text-left">
              <tr>
                <th className="p-3">구분</th>
                <th className="p-3">과목</th>
                <th className="p-3">활동</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr><td className="p-3 font-medium">의미</td><td className="p-3">기존 과목과 다른 교육 내용의 묶음 (내용의 체계성)</td><td className="p-3">학습 경험을 위해 구성한 다양한 활동</td></tr>
              <tr><td className="p-3 font-medium">승인</td><td className="p-3">교육감</td><td className="p-3">학교장 (학교운영위원회 심의)</td></tr>
              <tr><td className="p-3 font-medium">문서 구성</td><td className="p-3">성격, 목표, 내용 체계, 성취기준, 교수·학습 방법 및 평가, 지도의 실제</td><td className="p-3">필요성 및 목표, 내용 체계, 성취기준, 지도의 실제</td></tr>
              <tr><td className="p-3 font-medium">성취기준</td><td className="p-3">새로 개발</td><td className="p-3">새로 개발 또는 기존 성취기준 재구조화</td></tr>
              <tr><td className="p-3 font-medium">이름 중복</td><td className="p-3">전국 과목명과 중복 불가</td><td className="p-3">같은 학교·같은 해에 같은 활동명 불가</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
