"use client";

import { Modal } from "../Modal";

/** 'AI 답변 초기화'를 누르면 뜨는 확인 팝업. 빨간 '초기화'를 눌러야 지우고, 닫기·×는 그냥 닫는다. */
export function ResetConfirm({ what, onConfirm, onClose }: { what: string; onConfirm: () => void; onClose: () => void }) {
  return (
    <Modal
      title="AI 답변 초기화"
      onClose={onClose}
      actions={
        <>
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50">
            닫기
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="rounded-lg bg-red-600 px-5 py-2 font-bold text-white hover:bg-red-700"
          >
            초기화
          </button>
        </>
      }
    >
      <p className="font-semibold">이 단계에서 AI 답으로 만든 내용({what})을 모두 지울까요?</p>
      <p className="text-sm text-gray-600">실수로 지웠다면 화면 위쪽 <b>↶ 되돌리기</b>로 되살릴 수 있어요.</p>
    </Modal>
  );
}
