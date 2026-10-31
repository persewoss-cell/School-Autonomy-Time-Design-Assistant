import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { initialCheck } from "@/domain/hoursView";
import { autoReduce } from "@/validation/allocation";
import { buildAllocationXlsx } from "./allocationXlsx";

describe("엑셀 편성표", () => {
  it("docx와 같은 줄 구성에 계·합계·소계·연간·증감·판정이 수식으로 들어간다", async () => {
    const c = initialCheck(3, 2027, [{ id: "d", name: "우리 마을", grade: 3, semester: 1, hours: 29, subjectGroup: "사회", schoolYear: "2027" }]);
    c.input.courses.push({ name: "4학년 직접", subjectKey: "과학", semester: 2, hours: 29 });
    const buf = await buildAllocationXlsx(autoReduce(c.input), { years: [2027, 2027, 2028, 2028], grade: 3, schoolYear: 2027 });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const ws = wb.worksheets[0];
    const cells: { addr: string; v: unknown }[] = [];
    ws.eachRow((r) => r.eachCell((cell) => cells.push({ addr: cell.address, v: cell.value })));
    const text = cells.map((x) => (typeof x.v === "object" && x.v && "formula" in x.v ? "" : String(x.v ?? ""))).join("|");
    expect(text).toContain("3학년 교육과정 편성표");
    expect(text).toContain("우리 마을");
    expect(text).toContain("연간수업시간수");
    const formulas = cells.filter((x) => typeof x.v === "object" && x.v && "formula" in x.v).map((x) => x.v as { formula: string; result: unknown });
    expect(formulas.length).toBeGreaterThan(100);
    expect(formulas.some((x) => /^SUM\(H\d+:H\d+\)$/.test(x.formula))).toBe(true); // 소계
    expect(formulas.some((x) => /IF\(AND\(R\d+>=\d+,R\d+<=\d+\),"이상없음","범위 밖"\)/.test(x.formula))).toBe(true); // 교과(군) 판정
    expect(formulas.some((x) => x.formula.includes('"기준보다 "') && x.result === "이상없음")).toBe(true); // 연간 = 기준
    // 입력 칸(노란색)은 숫자 값
    expect(typeof ws.getCell("H7").value).toBe("number");
  });
});
