import { describe, expect, it } from "vitest";
import { sampleSubject } from "@/domain/sample";
import { buildPrintHtml } from "./printHtml";

describe("인쇄용(PDF) HTML", () => {
  it("과목: 서식3·4·7, 예시안 모양(제목 띠·개설 형태·회색 큰 제목·성취기준 상자)", () => {
    const html = buildPrintHtml(sampleSubject());
    expect(html).toContain("고시 외 과목 신설 승인 신청서");
    expect(html).toContain('<div class="t">「지구마을 첫걸음」</div><div class="badge">학교특색교육형</div>');
    expect(html).toContain('<div class="h1">1. 성격</div>');
    expect(html).toContain('<div class="std-box hcr">');
    expect(html).toContain("[과정중심평가]");
    expect(html).toContain("과목」 개설 체크리스트");
    expect(html).toContain("휴먼명조");
    expect(html).toContain("@page { size: A4");
  });
  it("활동: 필요성 및 목표, 성취기준 표, 지도의 실제, 평가 기준", () => {
    const doc = sampleSubject();
    doc.basic.type = "activity";
    const html = buildPrintHtml(doc);
    expect(html).toContain("1. 필요성 및 목표");
    expect(html).toContain('<table class="std-tbl hcr keep">');
    expect(html).toContain("4. 지도의 실제");
    expect(html).toContain("평가 기준");
    expect(html).not.toContain('class="badge"');
  });
  it("글자는 HTML로 안전하게 바꿔 넣는다", () => {
    const doc = sampleSubject();
    doc.basic.name = "<script>x</script>";
    expect(buildPrintHtml(doc)).toContain("「&lt;script&gt;x&lt;/script&gt;」");
  });
});
