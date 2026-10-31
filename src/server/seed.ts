import designs from "../../data/seed/gwangyang-designs.json";
import hours from "../../data/seed/gwangyang-hours.json";
import type { DesignDoc } from "@/domain/types";
import type { HourCheck, ViewGrade } from "@/domain/hoursView";
import { bandOfGrade, defaultAllocation, withCreativeParts, type CreativeParts, type FourSemesters, type SemesterIndex } from "@/validation/allocation";
import { nameKey } from "@/validation/names";
import type { Repo, User } from "./repo";
import { saveDesign, saveHourCheck, ServiceError } from "./services";

/**
 * 관리자 '광양중동초 자료 넣기': 광양중동초등학교가 운영한 학교자율시간 설계·시수 편성표·예시안을 한 번에 넣는다.
 * 원본 문서(PDF)를 옮긴 것이라 앱 규칙과 다른 곳이 있을 수 있다 (사용자 결정: 원본 그대로).
 * 이미 있는 것(같은 이름·학년도 설계, 같은 학년도·학년 시수 점검, 같은 예시안)은 건너뛰므로 여러 번 눌러도 안전하다.
 */
export const SEED_SCHOOL = "광양중동초등학교";

interface SeedHours {
  grade: ViewGrade;
  schoolYear: number;
  subjects: Record<string, FourSemesters>;
  creative: CreativeParts;
  /** design: true면 설계 현황의 같은 이름 설계와 연결 */
  courses: { name: string; subjectKey: string; semester: number; hours: number; design: boolean }[];
}

/** 예시안 파일 (data/seed/examples/파일명.pdf) */
export const SEED_EXAMPLES = [
  { name: "지구마을 첫걸음", schoolYear: "2026", type: "subject", grade: 3, semester: 2 },
  { name: "지구마을 이야기", schoolYear: "2026", type: "subject", grade: 4, semester: 2 },
  { name: "지구마을 히어로", schoolYear: "2026", type: "subject", grade: 5, semester: 2 },
  { name: "지구마을 탐험대", schoolYear: "2026", type: "subject", grade: 6, semester: 2 },
  { name: "디지털 탐험대 3", schoolYear: "2026", type: "subject", grade: 3, semester: 1 },
  { name: "디지털 탐험대 4", schoolYear: "2026", type: "subject", grade: 4, semester: 1 },
  { name: "디지털 탐험대 5", schoolYear: "2026", type: "subject", grade: 5, semester: 1 },
  { name: "디지털 탐험대 6", schoolYear: "2026", type: "subject", grade: 6, semester: 1 },
  { name: "지구촌, 함께 걷는 우리", schoolYear: "2024", type: "activity", grade: 6, semester: 2 },
] as const;

export interface SeedResult {
  designs: { added: number; skipped: number };
  hours: { added: number; skipped: number };
  examples: { added: number; skipped: number };
}

export const seedDesigns = () => structuredClone(designs) as unknown as DesignDoc[];

/** 시수 점검 한 화면: 엑셀 기본값 위에 편성표 숫자와 학교자율시간을 넣는다 */
export function seedHourCheck(h: SeedHours, designIdOf: (name: string) => string | undefined): HourCheck {
  const base = defaultAllocation(bandOfGrade(h.grade));
  const input = withCreativeParts({ ...base, subjectHours: { ...base.subjectHours, ...h.subjects } }, h.creative);
  input.courses = h.courses.map((c) => {
    const designId = c.design ? designIdOf(c.name) : undefined;
    return { name: c.name, subjectKey: c.subjectKey, semester: c.semester as SemesterIndex, hours: c.hours, ...(designId ? { designId } : {}) };
  });
  return { grade: h.grade, schoolYear: h.schoolYear, input, updatedAt: new Date().toISOString() };
}

export async function seedGwangyang(repo: Repo, admin: User, readExample: (name: string) => Promise<Buffer>): Promise<SeedResult> {
  const school = await repo.users.findBySchoolKey(nameKey(SEED_SCHOOL));
  if (!school) throw new ServiceError(404, `${SEED_SCHOOL} 계정이 없어요. 먼저 계정을 만들어 주세요.`);
  const result: SeedResult = { designs: { added: 0, skipped: 0 }, hours: { added: 0, skipped: 0 }, examples: { added: 0, skipped: 0 } };

  // 1) 설계: 같은 학년도에 같은 이름(띄어쓰기 무시)이 있으면 건너뜀
  const key = (name: string, year: string | number) => `${year}|${nameKey(name)}`;
  const mine = new Map((await repo.designs.listByOwner(school.id)).map((d) => [key(d.name, d.schoolYear), d.id]));
  for (const doc of seedDesigns()) {
    const k = key(doc.basic.name, doc.application.startYear);
    if (mine.has(k)) {
      result.designs.skipped++;
      continue;
    }
    const saved = await saveDesign(repo, school, doc);
    mine.set(k, saved.record.id);
    result.designs.added++;
  }

  // 2) 시수 점검: 같은 학년도·학년 화면이 이미 있으면 건너뜀 (학교가 고친 것을 덮어쓰지 않음)
  const checks = await repo.hourChecks.listByOwner(school.id);
  for (const h of hours as unknown as SeedHours[]) {
    if (checks.some((c) => c.grade === h.grade && (c.schoolYear ?? (c.data as { schoolYear?: number })?.schoolYear) === h.schoolYear)) {
      result.hours.skipped++;
      continue;
    }
    await saveHourCheck(repo, school, h.grade, seedHourCheck(h, (name) => mine.get(key(name, h.schoolYear))));
    result.hours.added++;
  }

  // 3) 예시안: 같은 이름·학년도·학년·학기가 있으면 건너뜀
  const examples = await repo.examples.list();
  for (const e of SEED_EXAMPLES) {
    if (examples.some((x) => nameKey(x.name) === nameKey(e.name) && x.schoolYear === e.schoolYear && x.grade === e.grade && x.semester === e.semester)) {
      result.examples.skipped++;
      continue;
    }
    const data = await readExample(e.name);
    await repo.examples.create(
      { ...e, fileName: `${e.name}.pdf`, contentType: "application/pdf", size: data.length, uploadedAt: new Date() },
      data,
    );
    result.examples.added++;
  }

  await repo.logs.add({
    kind: "admin",
    userId: admin.id,
    school: admin.schoolName,
    detail: `광양중동초 자료 넣기: 설계 ${result.designs.added}개, 시수 점검 ${result.hours.added}개, 예시안 ${result.examples.added}개`,
  });
  return result;
}
