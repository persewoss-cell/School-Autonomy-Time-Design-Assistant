/**
 * 관리자 '이용 통계' (사용자 결정, 2026-11-13)
 * - 최근 30일 날짜별 숫자 + 30일 합계 + 전체 누적
 * - 방문자·체험하기는 로그인 없이 세는 하루 숫자(누가 했는지는 남기지 않음)
 * - 가입·로그인·설계·내려받기는 이미 쌓인 이용 기록과 설계 목록으로 센다
 * - 관리자 계정(광양중동초)의 활동은 빼고 센다
 */

export const STAT_DAYS = 30;

/** 한국 시간 날짜 (2026-11-13) */
export const kstDay = (d: Date) => new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 10);

export interface StatCounts {
  /** 방문자 (하루 한 브라우저 1명) */
  visit: number;
  /** 로그인 없이 '체험하기'를 누른 횟수 */
  trial: number;
  /** 새로 가입한 학교 */
  signup: number;
  /** 로그인 횟수 */
  login: number;
  /** 로그인한 학교 수 (같은 학교는 1) */
  loginSchools: number;
  /** 새로 만든 설계 (가져온 설계 포함) */
  newDesigns: number;
  /** 설계 문서(.docx) 내려받기 */
  download: number;
  /** 활동지 내려받기 */
  worksheet: number;
  /** 기존 문서(hwpx) 가져오기 */
  import: number;
}

export interface SchoolStat {
  school: string;
  signup: number;
  login: number;
  newDesigns: number;
  download: number;
  worksheet: number;
  import: number;
}

export interface DayStat extends StatCounts {
  day: string;
  schools: SchoolStat[];
}

export interface UsageStats {
  days: DayStat[];
  last30: StatCounts;
  allTime: StatCounts;
  /** 방문자·체험하기를 세기 시작한 날 (없으면 null) */
  countingSince: string | null;
}

export interface StatInput {
  now: Date;
  counters: { day: string; key: "visit" | "trial"; n: number }[];
  /** 남아 있는 이용 기록 (1년 지난 기록은 자동 삭제) */
  logs: { kind: string; userId?: string; school?: string; createdAt: Date }[];
  designs: { ownerId: string; schoolName: string; createdAt: Date }[];
  users: { id: string; role: string; schoolName: string; createdAt: Date }[];
  /** 관리자 학교 이름 (띄어쓰기 없이) */
  adminSchools: string[];
}

const zero = (): StatCounts => ({ visit: 0, trial: 0, signup: 0, login: 0, loginSchools: 0, newDesigns: 0, download: 0, worksheet: 0, import: 0 });
const LOG_KEYS: Record<string, keyof SchoolStat> = { signup: "signup", login: "login", download: "download", worksheet_download: "worksheet", import: "import" };

export function usageStats(input: StatInput): UsageStats {
  const squash = (s?: string) => (s ?? "").replace(/\s+/g, "");
  const adminIds = new Set(input.users.filter((u) => u.role === "admin").map((u) => u.id));
  const adminNames = new Set([...input.adminSchools.map(squash), ...input.users.filter((u) => u.role === "admin").map((u) => squash(u.schoolName))]);
  const isAdmin = (userId?: string, school?: string) => (!!userId && adminIds.has(userId)) || (!!school && adminNames.has(squash(school)));

  const dayList = Array.from({ length: STAT_DAYS }, (_, i) => kstDay(new Date(input.now.getTime() - i * 86_400_000)));
  const days = new Map<string, DayStat>(dayList.map((d) => [d, { day: d, ...zero(), schools: [] }]));
  const school = (d: DayStat, name: string) => {
    let s = d.schools.find((x) => x.school === name);
    if (!s) d.schools.push((s = { school: name, signup: 0, login: 0, newDesigns: 0, download: 0, worksheet: 0, import: 0 }));
    return s;
  };

  const allTime = zero();
  const loginDaySchools = new Map<string, Set<string>>();
  const login30 = new Set<string>();
  const loginAll = new Set<string>();

  for (const c of input.counters) {
    allTime[c.key] += c.n;
    const d = days.get(c.day);
    if (d) d[c.key] += c.n;
  }
  for (const l of input.logs) {
    const key = LOG_KEYS[l.kind];
    if (!key || isAdmin(l.userId, l.school)) continue;
    const name = l.school || "(알 수 없음)";
    const day = kstDay(l.createdAt);
    if (key === "login") loginAll.add(name);
    // 가입은 사용자 목록으로 센다 (기록이 지워져도 남도록)
    if (key !== "signup") (allTime[key as keyof StatCounts] as number)++;
    const d = days.get(day);
    if (!d) continue;
    if (key !== "signup") {
      (d[key as keyof StatCounts] as number)++;
      school(d, name)[key]++;
    }
    if (key === "login") {
      login30.add(name);
      const set = loginDaySchools.get(day) ?? new Set();
      set.add(name);
      loginDaySchools.set(day, set);
    }
  }
  for (const u of input.users) {
    if (isAdmin(u.id, u.schoolName)) continue;
    allTime.signup++;
    const d = days.get(kstDay(u.createdAt));
    if (d) {
      d.signup++;
      school(d, u.schoolName).signup++;
    }
  }
  for (const ds of input.designs) {
    if (isAdmin(ds.ownerId, ds.schoolName)) continue;
    allTime.newDesigns++;
    const d = days.get(kstDay(ds.createdAt));
    if (d) {
      d.newDesigns++;
      school(d, ds.schoolName).newDesigns++;
    }
  }
  for (const [day, set] of loginDaySchools) days.get(day)!.loginSchools = set.size;
  allTime.loginSchools = loginAll.size;

  const list = dayList.map((d) => {
    const row = days.get(d)!;
    row.schools.sort((a, b) => a.school.localeCompare(b.school, "ko"));
    return row;
  });
  const last30 = zero();
  for (const r of list) for (const k of Object.keys(last30) as (keyof StatCounts)[]) if (k !== "loginSchools") last30[k] += r[k];
  last30.loginSchools = login30.size;
  const started = input.counters.map((c) => c.day).sort()[0] ?? null;
  return { days: list, last30, allTime, countingSince: started };
}
