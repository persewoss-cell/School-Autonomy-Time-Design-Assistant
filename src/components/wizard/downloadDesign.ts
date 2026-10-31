"use client";

import { Packer } from "docx";
import type { DesignDoc } from "@/domain/types";
import { bandStatus, viewYears, type Checks, type DesignBrief } from "@/domain/hoursView";
import { buildDesignDocx, docxFileName, type AllocationAttachment, type PendingAllocation } from "@/export/docx";

/** 내려받기 전에 보여 주는 안내 (최종 점검 화면·설계 현황 같이 씀) */
export const FORM_NOTICE = "내려받는 문서는 교육청에서 제공하는 양식과 다를 수 있습니다.\n한글(HWP)에서 열어 양식을 다듬어 쓰세요.";

/** 이 설계를 시수 점검 목록에 넣을 때의 요약 */
export function briefOf(doc: DesignDoc, id: string): DesignBrief {
  const b = doc.basic;
  return { id, name: b.name, grade: b.grade, semester: b.semester, hours: b.hours, subjectGroup: b.subjectGroup, schoolYear: doc.application.startYear };
}

/** 붙임 편성표: 그 학년도 학년군 시수 점검을 마쳤으면 편성표, 아니면 빨간 안내 */
export function allocationFor(doc: DesignDoc, id: string, checks: Checks, designs: DesignBrief[]) {
  const year = Number(doc.application.startYear) || 2027;
  const briefs = [...designs.filter((d) => d.id !== id), briefOf(doc, id)];
  const status = bandStatus(doc.basic.grade, year, checks, briefs);
  const own = status.okCheck;
  const attachment: AllocationAttachment | PendingAllocation =
    status.complete && own
      ? { input: own.input, years: viewYears(own.grade, own.schoolYear), grade: own.grade, schoolYear: own.schoolYear }
      : { pending: true, grade: doc.basic.grade };
  return { status, year, attachment };
}

/** .docx를 만들어 내려받기 */
export async function saveDesignDocx(doc: DesignDoc, attachment: AllocationAttachment | PendingAllocation) {
  const blob = await Packer.toBlob(buildDesignDocx(doc, attachment));
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = docxFileName(doc);
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
