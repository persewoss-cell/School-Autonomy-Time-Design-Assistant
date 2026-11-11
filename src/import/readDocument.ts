"use client";

import { pdfPageText, hwpxSectionText, sortSections } from "./textLayout";

export interface ReadResult {
  text: string;
  pages: number;
  kind: "pdf" | "hwpx";
}

/** 브라우저에서 PDF·hwpx 파일의 글자를 뽑는다. 파일은 서버로 보내지 않는다. */
export async function readDocument(file: File): Promise<ReadResult> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return readPdf(file);
  if (name.endsWith(".hwpx")) return readHwpx(file);
  if (name.endsWith(".hwp")) throw new Error("예전 한글 파일(.hwp)은 읽을 수 없어요. 한글에서 '다른 이름으로 저장 → .hwpx' 또는 PDF로 저장해 올려 주세요.");
  throw new Error("PDF(.pdf) 또는 한글(.hwpx) 파일만 올릴 수 있어요.");
}

async function readPdf(file: File): Promise<ReadResult> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const items = content.items.flatMap((it) =>
      "str" in it ? [{ str: it.str, x: it.transform[4], y: it.transform[5], width: it.width, height: it.height || Math.abs(it.transform[3]) }] : [],
    );
    pages.push(pdfPageText(items));
  }
  await pdf.destroy();
  return { text: pages.map((t, i) => `[${i + 1}쪽]\n${t}`).join("\n\n"), pages: pages.length, kind: "pdf" };
}

async function readHwpx(file: File): Promise<ReadResult> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const sections = sortSections(Object.keys(zip.files));
  if (sections.length === 0) throw new Error("한글(hwpx) 파일의 본문을 찾지 못했어요. 파일이 손상되지 않았는지 확인해 주세요.");
  const texts: string[] = [];
  for (const s of sections) texts.push(hwpxSectionText(await zip.files[s].async("string")));
  return { text: texts.join("\n\n"), pages: sections.length, kind: "hwpx" };
}

/** 뽑은 글자가 거의 없으면 스캔(그림) 문서로 본다 */
export const looksScanned = (r: ReadResult) => r.text.replace(/\[\d+쪽\]|\s/g, "").length < 50 * Math.max(1, r.kind === "pdf" ? r.pages : 1);
