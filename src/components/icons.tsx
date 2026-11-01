/** 내려받기 아이콘: 받침 위로 내려오는 화살표 */
export function DownloadIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 3v11" />
      <path d="M7.5 10 12 14.5 16.5 10" />
      <path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" />
    </svg>
  );
}

/** 새 창으로 열기 아이콘: 상자에서 오른쪽 위로 나가는 화살표 */
export function OpenNewIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M14 4h6v6" />
      <path d="M20 4 11 13" />
      <path d="M18 14v4.5A1.5 1.5 0 0 1 16.5 20h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" />
    </svg>
  );
}

/** 돋보기 아이콘: 설계 열어 보기 */
export function SearchIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 5 5" />
    </svg>
  );
}

/** 저장(디스켓) 아이콘 */
export function SaveIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M5.5 4h10.8L20 7.7v10.8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-13A1.5 1.5 0 0 1 5.5 4Z" />
      <path d="M8 4v5h7V4" />
      <rect x="7.5" y="13" width="9" height="7" rx="0.8" />
    </svg>
  );
}

/** 완료 표시: 초록 동그라미 안 흰 체크 (시수점검 완료 등) */
export function CheckCircleIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="#16a34a" />
      <path d="M7 12.5l3.2 3.2L17 9" stroke="#fff" strokeWidth={2.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 표 안의 아이콘 버튼 (글자색은 쓰는 곳에서): 마우스를 올리면 연한 초록 바탕·진한 초록으로 바뀌고 손가락 모양 */
export const ICON_BTN =
  "inline-flex cursor-pointer rounded-lg p-1.5 transition-colors hover:bg-brand-100 hover:text-brand-700 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent";
