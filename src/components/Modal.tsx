"use client";


/** 화면 가운데 뜨는 알림 창. 바깥을 눌러도 닫히지 않고, 닫기 버튼이나 오른쪽 위 ×로만 닫는다 (사용자 결정, 2026-11-03). */
export function Modal({
  title,
  tone = "red",
  onClose,
  children,
  actions,
  wide,
  xl,
}: {
  title: string;
  /** 넓은 창 (표를 보여 줄 때) */
  wide?: boolean;
  /** 아주 큰 창 (문서 미리보기). 내용이 길면 창 안에서 스크롤 */
  xl?: boolean;
  tone?: "red" | "amber" | "brand";
  onClose: () => void;
  children: React.ReactNode;
  actions: React.ReactNode;
}) {
  const head = tone === "red" ? "bg-red-600" : tone === "amber" ? "bg-amber-500" : "bg-brand-600";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div role="alertdialog" aria-modal="true" aria-label={title} className={`w-full ${xl ? "max-w-6xl" : wide ? "max-w-3xl" : "max-w-md"} overflow-hidden rounded-2xl bg-white shadow-2xl`} onClick={(e) => e.stopPropagation()}>
        <div className={`flex items-center justify-between gap-2 px-5 py-3 text-white ${head}`}>
          <p className="text-lg font-bold">{tone === "brand" ? "" : "⚠ "}{title}</p>
          <button type="button" aria-label="닫기" onClick={onClose} className="rounded-md px-2 text-2xl leading-none text-white/90 hover:bg-white/20">
            ×
          </button>
        </div>
        {/* 내용이 길면 창 안에서 스크롤 (아래 버튼이 늘 보이게) */}
        <div className={`space-y-2 overflow-y-auto overscroll-contain px-5 py-4 text-[15px] text-gray-800 ${xl ? "max-h-[78vh] bg-gray-50" : "max-h-[calc(100vh-11rem)]"}`}>{children}</div>
        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-3">{actions}</div>
      </div>
    </div>
  );
}
