"use client";

import { hwpxSectionText, sortSections } from "./textLayout";

export interface ReadResult {
  text: string;
  /** hwpx 본문(section) 수 */
  pages: number;
}

/** 브라우저에서 한글(hwpx) 파일의 글자를 뽑는다. 파일은 서버로 보내지 않는다. */
export async function readDocument(file: File): Promise<ReadResult> {
  // 한글(hwpx)만 받는다 (사용자 결정, 2026-11-11): PDF는 표 칸이 줄마다 섞여 읽혀 AI가 잘못 옮기기 쉬움
  const name = file.name.toLowerCase();
  if (name.endsWith(".hwpx")) return readHwpx(file);
  if (name.endsWith(".hwp")) throw new Error("예전 한글 파일(.hwp)은 읽을 수 없어요. 한글에서 [파일] → [다른 이름으로 저장] → 파일 형식 'HWPX'로 저장해 올려 주세요.");
  if (name.endsWith(".pdf")) throw new Error("PDF는 표가 섞여 읽혀서 받지 않아요. 원본 한글 파일을 [다른 이름으로 저장] → 'HWPX'로 저장해 올려 주세요.");
  throw new Error("한글(.hwpx) 파일만 올릴 수 있어요.");
}

async function readHwpx(file: File): Promise<ReadResult> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const sections = sortSections(Object.keys(zip.files));
  if (sections.length === 0) throw new Error("한글(hwpx) 파일의 본문을 찾지 못했어요. 파일이 손상되지 않았는지 확인해 주세요.");
  const texts: string[] = [];
  for (const s of sections) texts.push(hwpxSectionText(await zip.files[s].async("string")));
  const text = texts.join("\n\n");
  if (!text.trim()) throw new Error("한글 파일에서 글자를 찾지 못했어요. 그림으로만 된 문서인지 확인해 주세요.");
  return { text, pages: sections.length };
}
