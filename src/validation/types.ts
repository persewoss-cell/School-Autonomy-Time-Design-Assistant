/** 검증 결과 한 건. 사용자에게 "어느 항목이 / 왜 / 어떻게 고치면 되는지" 보여 준다. */
export interface Issue {
  level: "error" | "warning";
  /** 문제가 있는 항목 이름 (화면 표시용) */
  field: string;
  /** 왜 틀렸는지 */
  message: string;
  /** 어떻게 고치면 되는지 */
  fix: string;
}
