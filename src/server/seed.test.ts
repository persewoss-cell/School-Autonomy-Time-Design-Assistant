import { describe, expect, it } from "vitest";
import { memoryRepo } from "./repo";
import { listHourChecks, listMyDesigns, signup } from "./services";
import { SEED_EXAMPLES, seedDesigns, seedGwangyang } from "./seed";
import { bandStatus, type Checks, type HourCheck } from "@/domain/hoursView";
import { checkAllocation } from "@/validation/allocation";
import { Packer } from "docx";
import { buildDesignDocx } from "@/export/docx";

const school = (schoolName: string) => ({ region: "광양시", schoolName, password: "password1", passwordConfirm: "password1" });
const fakePdf = async (name: string) => Buffer.from(`%PDF ${name}`);

describe("광양중동초 자료 넣기", () => {
  it("설계 9개·시수 점검 4개·예시안 9개를 넣고, 다시 눌러도 늘지 않는다", async () => {
    const repo = memoryRepo();
    const admin = await signup(repo, school("광양중동초등학교"), ["광양중동초등학교"]);
    const first = await seedGwangyang(repo, admin, fakePdf);
    expect(first).toEqual({ designs: { added: 9, skipped: 0 }, hours: { added: 4, skipped: 0 }, examples: { added: 9, skipped: 0 } });
    const again = await seedGwangyang(repo, admin, fakePdf);
    expect(again).toEqual({ designs: { added: 0, skipped: 9 }, hours: { added: 0, skipped: 4 }, examples: { added: 0, skipped: 9 } });

    const list = await listMyDesigns(repo, admin);
    expect(list).toHaveLength(9);
    expect(list.filter((d) => d.type === "activity").map((d) => d.name).sort()).toEqual(["지구마을 이야기", "지구마을 첫걸음", "지구마을 탐험대", "지구마을 히어로", "지구촌, 함께 걷는 우리"]);
    expect(list.find((d) => d.name === "지구촌, 함께 걷는 우리")?.schoolYear).toBe("2024");
    expect((await repo.examples.list()).map((e) => e.name).sort()).toEqual(SEED_EXAMPLES.map((e) => e.name).sort());

    // 2026학년도 편성표: 숫자가 지침 범위 안이고, 설계와 연결돼 학년별 시수 점검 완료
    const checks: Checks = Object.fromEntries(
      (await listHourChecks(repo, admin)).map((c) => {
        const h = c.data as HourCheck;
        return [`${h.schoolYear}-${h.grade}`, h];
      }),
    );
    expect(Object.keys(checks).sort()).toEqual(["2026-3", "2026-4", "2026-5", "2026-6"]);
    for (const h of Object.values(checks)) {
      expect(checkAllocation(h.input).issues.filter((i) => i.level === "error"), `${h.grade}학년 화면`).toEqual([]);
    }
    const briefs = list.map((d) => ({ ...d, schoolYear: d.schoolYear }));
    for (const g of [3, 4, 5, 6]) expect(bandStatus(g, 2026, checks, briefs).complete, `${g}학년`).toBe(true);
  });

  it("학교 계정이 없으면 알려 준다", async () => {
    const repo = memoryRepo();
    const admin = await signup(repo, school("목포중앙초등학교"), ["목포중앙초등학교"]);
    await expect(seedGwangyang(repo, admin, fakePdf)).rejects.toThrow("광양중동초등학교 계정이 없어요");
  });

  it("원본을 옮긴 설계: 학년·학기·시수·유형이 원본과 같다", () => {
    const rows = seedDesigns().map((d) => [d.basic.name, d.basic.type, d.basic.grade, d.basic.semester, d.basic.hours, d.application.startYear]);
    expect(rows).toContainEqual(["지구마을 첫걸음", "activity", 3, 2, 29, "2026"]);
    expect(rows).toContainEqual(["디지털 탐험대 6", "subject", 6, 1, 32, "2026"]);
    for (const d of seedDesigns()) {
      const sum = d.plan.selected!.units.flatMap((u) => u.lessons).reduce((s, l) => s + l.hours, 0);
      expect(sum, d.basic.name).toBe(d.basic.hours);
    }
  });

  it("옮긴 설계 9개 모두 .docx로 만들어진다", async () => {
    for (const d of seedDesigns()) {
      const buf = await Packer.toBuffer(await buildDesignDocx(d));
      expect(buf.length, d.basic.name).toBeGreaterThan(5000);
    }
  });
});
