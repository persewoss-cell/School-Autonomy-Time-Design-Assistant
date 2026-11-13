import { describe, expect, it } from "vitest";
import { kstDay, STAT_DAYS, usageStats } from "./usageStats";

const now = new Date("2026-11-13T03:00:00Z"); // 한국 12시
const daysAgo = (n: number, h = 3) => new Date(now.getTime() - n * 86_400_000 + (h - 3) * 3600_000);

describe("이용 통계", () => {
  const base = {
    now,
    adminSchools: ["광양중동초등학교"],
    users: [
      { id: "admin", role: "admin", schoolName: "광양중동초등학교", createdAt: daysAgo(100) },
      { id: "a", role: "teacher", schoolName: "덕례초등학교", createdAt: daysAgo(0) },
      { id: "b", role: "teacher", schoolName: "옥룡초등학교", createdAt: daysAgo(40) },
    ],
    counters: [
      { day: kstDay(daysAgo(0)), key: "visit" as const, n: 5 },
      { day: kstDay(daysAgo(0)), key: "trial" as const, n: 2 },
      { day: kstDay(daysAgo(45)), key: "visit" as const, n: 7 },
    ],
    logs: [
      { kind: "login", userId: "a", school: "덕례초등학교", createdAt: daysAgo(0) },
      { kind: "login", userId: "a", school: "덕례초등학교", createdAt: daysAgo(0) },
      { kind: "login", userId: "b", school: "옥룡초등학교", createdAt: daysAgo(1) },
      { kind: "login", userId: "admin", school: "광양중동초등학교", createdAt: daysAgo(0) },
      { kind: "download", userId: "a", school: "덕례초등학교", createdAt: daysAgo(0) },
      { kind: "worksheet_download", userId: "b", school: "옥룡초등학교", createdAt: daysAgo(2) },
      { kind: "import", userId: "admin", school: "광양중동초등학교", createdAt: daysAgo(0) },
      { kind: "download", userId: "b", school: "옥룡초등학교", createdAt: daysAgo(60) },
      { kind: "save", userId: "a", school: "덕례초등학교", createdAt: daysAgo(0) },
    ],
    designs: [
      { ownerId: "a", schoolName: "덕례초등학교", createdAt: daysAgo(0) },
      { ownerId: "admin", schoolName: "광양중동초등학교", createdAt: daysAgo(0) },
      { ownerId: "b", schoolName: "옥룡초등학교", createdAt: daysAgo(50) },
    ],
  };
  it("최근 30일 날짜별 (오늘부터), 관리자는 빼고, 30일 합계와 전체 누적", () => {
    const s = usageStats(base);
    expect(s.days).toHaveLength(STAT_DAYS);
    expect(s.days[0].day).toBe("2026-11-13");
    expect(s.days[0]).toMatchObject({ visit: 5, trial: 2, signup: 1, login: 2, loginSchools: 1, newDesigns: 1, download: 1, import: 0 });
    expect(s.days[0].schools).toEqual([{ school: "덕례초등학교", signup: 1, login: 2, newDesigns: 1, download: 1, worksheet: 0, import: 0 }]);
    expect(s.days[1]).toMatchObject({ login: 1, loginSchools: 1 });
    expect(s.last30).toMatchObject({ visit: 5, trial: 2, signup: 1, login: 3, loginSchools: 2, newDesigns: 1, download: 1, worksheet: 1, import: 0 });
    expect(s.allTime).toMatchObject({ visit: 12, trial: 2, signup: 2, login: 3, loginSchools: 2, newDesigns: 2, download: 2, worksheet: 1, import: 0 });
    expect(s.countingSince).toBe(kstDay(daysAgo(45)));
  });
  it("날짜는 한국 시간 기준 (밤 11시 기록은 그날)", () => {
    expect(kstDay(new Date("2026-11-12T14:30:00Z"))).toBe("2026-11-12");
    expect(kstDay(new Date("2026-11-12T15:30:00Z"))).toBe("2026-11-13");
  });
  it("기록이 없으면 0", () => {
    const s = usageStats({ ...base, counters: [], logs: [], designs: [], users: [] });
    expect(s.last30.visit).toBe(0);
    expect(s.countingSince).toBeNull();
  });
});
