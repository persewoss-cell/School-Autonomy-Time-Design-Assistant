import { describe, expect, it } from "vitest";
import { hwpxSectionText, pdfPageText, sortSections } from "./textLayout";

describe("pdfPageText", () => {
  it("같은 높이는 한 줄, 넓은 간격은 표 칸(|)으로 나눈다", () => {
    const text = pdfPageText([
      { str: "단원명", x: 50, y: 700, width: 30, height: 10 },
      { str: "학습주제", x: 200, y: 700.5, width: 40, height: 10 },
      { str: "1단원", x: 50, y: 680, width: 25, height: 10 },
      { str: "작가", x: 200, y: 680, width: 20, height: 10 },
      { str: "만남", x: 222, y: 680, width: 20, height: 10 },
    ]);
    expect(text).toBe("단원명 | 학습주제\n1단원 | 작가 만남");
  });
  it("빈 쪽은 빈 문자열", () => {
    expect(pdfPageText([{ str: " ", x: 0, y: 0, width: 1, height: 10 }])).toBe("");
  });
});

describe("hwpxSectionText", () => {
  it("문단은 줄로, 표는 행마다 | 칸 | 칸 | 으로", () => {
    const xml = `<hs:sec><hp:p><hp:run><hp:t>나도 그림책 작가</hp:t></hp:run></hp:p>
      <hp:p><hp:run><hp:tbl><hp:tr><hp:tc><hp:subList><hp:p><hp:run><hp:t>단원</hp:t></hp:run></hp:p></hp:subList></hp:tc>
      <hp:tc><hp:subList><hp:p><hp:run><hp:t>1. 먼저 읽어요</hp:t></hp:run></hp:p><hp:p><hp:run><hp:t>(8차시)</hp:t></hp:run></hp:p></hp:subList></hp:tc></hp:tr></hp:tbl></hp:run></hp:p>
      <hp:p><hp:run><hp:t>A &amp; B</hp:t><hp:t/></hp:run></hp:p></hs:sec>`;
    expect(hwpxSectionText(xml)).toBe("나도 그림책 작가\n| 단원 | 1. 먼저 읽어요 / (8차시) |\nA & B");
  });
  it("section 파일을 번호 순으로", () => {
    expect(sortSections(["Contents/section10.xml", "Contents/header.xml", "Contents/section2.xml", "Contents/section0.xml"])).toEqual([
      "Contents/section0.xml",
      "Contents/section2.xml",
      "Contents/section10.xml",
    ]);
  });
});
