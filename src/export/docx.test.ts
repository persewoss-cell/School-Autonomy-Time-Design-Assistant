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

describe("편성표 docx", () => {
  it("학교 편성표 양식: 학교자율시간 줄과 증감이 들어간다", async () => {
    const { buildAllocationDocx } = await import("./allocationDocx");
    const { defaultAllocation } = await import("@/validation/allocation");
    const a = defaultAllocation("5-6");
    a.courses = [{ name: "나도 인문작가", subjectKey: "국어", semester: 0, hours: 32 }];
    const buf = await Packer.toBuffer(buildAllocationDocx(a));
    const { default: JSZip } = await import("jszip");
    const text = (await (await JSZip.loadAsync(buf)).file("word/document.xml")!.async("string")).replace(/<[^>]+>/g, "");
    expect(text).toContain("5학년 교육과정 편성표");
    expect(text).toContain("나도 인문작가");
    expect(text).toContain("+32"); // 학교자율시간 줄: 1학기 증감
  });
});

describe("설계 문서에 시수 점검표 붙이기", () => {
  it("시수 점검이 있으면 문서 끝에 편성표가 들어간다", async () => {
    const { initialCheck, viewYears } = await import("@/domain/hoursView");
    const c = initialCheck(3, 2026, [{ id: "x", name: "지구마을 첫걸음", grade: 3, semester: 2, hours: 29, subjectGroup: "사회" }]);
    const buf = await Packer.toBuffer(buildDesignDocx(sampleSubject(), { input: c.input, years: viewYears(3, 2026), grade: 3, schoolYear: 2026 }));
    const { default: JSZip } = await import("jszip");
    const text = (await (await JSZip.loadAsync(buf)).file("word/document.xml")!.async("string")).replace(/<[^>]+>/g, "");
    expect(text).toContain("[붙임] (3)학년 교육과정 편성표");
    expect(text).toContain("3학년 교육과정 편성표");
    expect(text).toContain("3학년(2026학년도)");
    expect(text).toContain("4학년(2027학년도)");
    expect(text).toContain("사회/도덕");
    expect(text).toContain("동아리활동");
    expect(text).toContain("연간수업시간수");
  });
  it("시수 점검을 마치지 않았으면 편성표 대신 빨간 안내가 들어간다", async () => {
    const buf = await Packer.toBuffer(buildDesignDocx(sampleSubject(), { pending: true, grade: 3 }));
    const { default: JSZip } = await import("jszip");
    const xml = await (await JSZip.loadAsync(buf)).file("word/document.xml")!.async("string");
    const text = xml.replace(/<[^>]+>/g, "");
    expect(text).toContain("[붙임] (3)학년 교육과정 편성표");
    expect(text).toContain("시수 점검을 마쳐야 편성표가 표시됩니다");
    expect(text).not.toContain("연간수업시간수");
    expect(xml).toContain("C00000");
  });
});
