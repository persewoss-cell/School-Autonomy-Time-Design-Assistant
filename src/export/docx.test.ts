import { describe, expect, it } from "vitest";
import { Packer } from "docx";
import { sampleSubject } from "@/domain/sample";
import { buildDesignDocx, docxFileName } from "./docx";

async function xmlOf(doc: ReturnType<typeof sampleSubject>) {
  const buf = await Packer.toBuffer(buildDesignDocx(doc));
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(buf);
  return (await zip.file("word/document.xml")!.async("string")).replace(/<[^>]+>/g, "");
}

describe("docx 만들기", () => {
  it("과목: 신청서·교육과정·체크리스트가 들어간다", async () => {
    const text = await xmlOf(sampleSubject());
    expect(text).toContain("고시 외 과목 신설 승인 신청서");
    expect(text).toContain("전남광주통합특별시교육감 귀하");
    expect(text).toContain("1. 성격");
    expect(text).toContain("[3사지구02-02]");
    expect(text).toContain("다. 단원 지도 계획");
    expect(text).toContain("27~29/29");
    expect(text).toContain("[과정중심평가]");
    expect(text).toContain("과목」 개설 체크리스트");
    expect(text).toContain("■ 사회");
  });
  it("활동: 계획서·교육과정(필요성 및 목표, 지도의 실제)", async () => {
    const doc = sampleSubject();
    doc.basic.type = "activity";
    const text = await xmlOf(doc);
    expect(text).toContain("학교자율시간 활동 계획서");
    expect(text).toContain("1. 필요성 및 목표");
    expect(text).toContain("4. 지도의 실제");
    expect(text).toContain("광양중동초등학교운영위원장 귀하");
  });
  it("파일 이름", () => {
    expect(docxFileName(sampleSubject())).toBe("지구마을 첫걸음_학교자율시간_과목_3학년2학기.docx");
  });
});
