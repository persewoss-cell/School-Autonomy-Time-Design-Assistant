import type { Category } from "@/domain/types";

/**
 * 내용 체계 범주별 색 (사용자가 고른 색: 지식·이해 #FDEADA 살구, 과정·기능 #EBF1DE 연두, 가치·태도 #DBEEF4 하늘).
 * 범주 이름 칸은 고른 색 그대로, 내용 칸은 더 연하게, 테두리·글자는 같은 계열의 진한 색.
 * 내용 체계 표와 성취기준 내용 요소 칩에서 같이 씀.
 */
export const CATEGORY_STYLE: Record<Category, { head: string; cell: string; box: string; chipOn: string; chipOff: string; badge: string }> = {
  knowledge: {
    head: "bg-[#FDEADA] text-[#8A4A1C]",
    cell: "bg-[#FEF6EF]",
    box: "border-[#F3CFB1] bg-white hover:border-[#E8AE80]",
    chipOn: "border-[#D9874A] bg-[#FBD9BD] font-semibold text-[#7A3E14]",
    chipOff: "border-[#F3CFB1] bg-[#FDEADA] text-[#8A4A1C] hover:border-[#D9874A]",
    badge: "bg-[#FDEADA] text-[#8A4A1C]",
  },
  process: {
    head: "bg-[#EBF1DE] text-[#4A5E22]",
    cell: "bg-[#F6F9F0]",
    box: "border-[#CFDDB0] bg-white hover:border-[#AFC684]",
    chipOn: "border-[#8AA552] bg-[#D8E6BE] font-semibold text-[#3F521B]",
    chipOff: "border-[#CFDDB0] bg-[#EBF1DE] text-[#4A5E22] hover:border-[#8AA552]",
    badge: "bg-[#EBF1DE] text-[#4A5E22]",
  },
  values: {
    head: "bg-[#DBEEF4] text-[#1F5767]",
    cell: "bg-[#EFF8FB]",
    box: "border-[#B3DAE6] bg-white hover:border-[#86C2D4]",
    chipOn: "border-[#4E9DB5] bg-[#BFE2EC] font-semibold text-[#184C5A]",
    chipOff: "border-[#B3DAE6] bg-[#DBEEF4] text-[#1F5767] hover:border-[#4E9DB5]",
    badge: "bg-[#DBEEF4] text-[#1F5767]",
  },
};
