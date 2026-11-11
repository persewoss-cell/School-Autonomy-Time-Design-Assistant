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
  it("가로 종이에 두 쪽을 나란히 찍은 PDF는 왼쪽 쪽부터 읽는다", () => {
    const item = (str: string, x: number, y: number) => ({ str, x, y, width: 60, height: 10 });
    const left = ["1단원", "학습주제", "도형 삽입", "표 만들기", "발표하기"].map((t, i) => item(t, 50, 500 - i * 20));
    const right = ["2단원", "코딩", "미로 게임", "센서보드", "인공지능"].map((t, i) => item(t, 470, 500 - i * 20));
    const text = pdfPageText([...left, ...right], { width: 841, height: 595 });
    expect(text.split("\n\n")).toEqual(["1단원\n학습주제\n도형 삽입\n표 만들기\n발표하기", "2단원\n코딩\n미로 게임\n센서보드\n인공지능"]);
    // 세로 종이는 그대로 (표의 칸으로 읽음)
    expect(pdfPageText([...left, ...right], { width: 595, height: 841 }).split("\n")[0]).toBe("1단원 | 2단원");
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
  it("한글 메모(검토 의견)는 빼고 본문만", () => {
    const xml = `<hp:p><hp:run><hp:t>「에코 리터러시」</hp:t><hp:ctrl><hp:fieldBegin id="1" type="MEMO"><hp:subList><hp:p><hp:run><hp:t>총괄목표 기술</hp:t></hp:run></hp:p></hp:subList></hp:fieldBegin></hp:ctrl><hp:t>활동은</hp:t><hp:ctrl><hp:fieldEnd beginIDRef="1"/></hp:ctrl></hp:run></hp:p>
      <hp:p><hp:run><hp:ctrl><hp:fieldBegin id="2" type="HYPERLINK"/></hp:ctrl><hp:t>링크 글</hp:t></hp:run></hp:p>`;
    expect(hwpxSectionText(xml)).toBe("「에코 리터러시」활동은\n링크 글");
  });

  it("section 파일을 번호 순으로", () => {
    expect(sortSections(["Contents/section10.xml", "Contents/header.xml", "Contents/section2.xml", "Contents/section0.xml"])).toEqual([
      "Contents/section0.xml",
      "Contents/section2.xml",
      "Contents/section10.xml",
    ]);
  });
});
