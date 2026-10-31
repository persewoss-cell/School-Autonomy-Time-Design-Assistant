import { nameKey } from "@/validation/names";
import type { DesignDoc } from "@/domain/types";

/**
 * 저장소 인터페이스. 실제 서비스는 MongoDB(mongoRepo), 테스트는 메모리(memoryRepo)를 쓴다.
 * 학생 개인정보는 저장하지 않는다. 프롬프트·AI 답 원문도 저장하지 않는다.
 */

export type Role = "teacher" | "admin";
export type UserStatus = "pending" | "active" | "blocked";

/** 계정은 학교 단위: 한 학교당 1개. 로그인은 학교명 + 비밀번호. */
export interface User {
  id: string;
  /** 지역 (전남, 광주) */
  region: string;
  /** 학교 정식 명칭 (띄어쓰기 없이 저장) */
  schoolName: string;
  /** 중복 확인·로그인용 키 (= 띄어쓰기 없는 학교명) */
  schoolKey: string;
  passwordHash: string;
  role: Role;
  status: UserStatus;
  /** 임시 비밀번호로 바꾼 뒤 첫 로그인에서 새 비밀번호로 바꾸게 함 */
  mustChangePassword: boolean;
  /** 비밀번호 재설정 요청 (관리자가 처리하면 지움) */
  resetRequest: { requestedAt: Date; contact: string } | null;
  createdAt: Date;
  lastLoginAt: Date | null;
}

export interface DesignRecord {
  id: string;
  ownerId: string;
  doc: DesignDoc;
  /** 목록·검색용으로 doc에서 뽑아 둔 값 */
  name: string;
  type: "subject" | "activity";
  grade: number;
  semester: number;
  /** 운영 시수 (학년·학기별 합계 계산용. 예전 저장본에는 없을 수 있음) */
  hours?: number;
  /** 편성 교과 (시수 점검에 쓰임. 예전 저장본에는 없을 수 있음) */
  subjectGroup?: string;
  schoolName: string;
  schoolYear: string;
  errorCount: number;
  warningCount: number;
  /** warningCount 중 '운영 시수' 경고 수 (목록을 볼 때 같은 학기 설계에 맞춰 다시 계산하려고. 예전 저장본에는 없음) */
  hoursWarnings?: number;
  /** 무시한 확인 필요 점검 (doc.dismissed 복사본, 목록에서 다시 셀 때 씀) */
  dismissed?: string[];
  /** 아직 ○가 아닌 체크리스트 항목 수 (0이면 문서를 내려받을 수 있음. 예전 저장본에는 없을 수 있음) */
  checklistLeft?: number;
  /** 어디까지 작성했는지 (doc.progress 복사본, 목록 표시용) */
  progress: { stepKey: string; maxIndex: number } | null;
  createdAt: Date;
  updatedAt: Date;
}

export type LogKind = "signup" | "login" | "login_fail" | "save" | "delete" | "download" | "parse_fail" | "reset_request" | "password_reset" | "password_change";

export interface LogEntry {
  id: string;
  kind: LogKind;
  userId?: string;
  /** 누가 (학교명) */
  school?: string;
  designId?: string;
  /** 짧은 설명 (예: 답 읽기 실패 단계와 이유). 원문은 저장하지 않음 */
  detail?: string;
  createdAt: Date;
}

export type DesignSummary = Omit<DesignRecord, "doc">;

/** 학교(계정)별 시수 점검 화면 저장본. 학년도 × 학년 화면(3~6)마다 하나 */
export interface HourCheckRecord {
  ownerId: string;
  grade: number;
  /** 점검 학년도 (예전 저장본에는 없을 수 있어 data.schoolYear로 대신함) */
  schoolYear?: number;
  /** 화면 내용 (src/domain/hoursView.ts HourCheck) */
  data: unknown;
  updatedAt: Date;
}

export interface Repo {
  users: {
    findBySchoolKey(schoolKey: string): Promise<User | null>;
    findById(id: string): Promise<User | null>;
    create(u: Omit<User, "id">): Promise<User>;
    update(id: string, patch: Partial<Omit<User, "id" | "schoolKey">>): Promise<void>;
    list(): Promise<User[]>;
  };
  designs: {
    create(d: Omit<DesignRecord, "id">): Promise<DesignRecord>;
    get(id: string): Promise<DesignRecord | null>;
    update(id: string, patch: Partial<Omit<DesignRecord, "id" | "ownerId" | "createdAt">>): Promise<void>;
    delete(id: string): Promise<void>;
    listByOwner(ownerId: string): Promise<DesignSummary[]>;
    listAll(): Promise<DesignSummary[]>;
    /** 같은 학교·같은 학년도에 같은 이름(띄어쓰기 무시)의 과목·활동이 있는지 */
    findSameActivity(schoolName: string, schoolYear: string, name: string, excludeId?: string): Promise<DesignSummary | null>;
    saveVersion(designId: string, doc: DesignDoc): Promise<void>;
  };
  hourChecks: {
    listByOwner(ownerId: string): Promise<HourCheckRecord[]>;
    upsert(r: HourCheckRecord): Promise<void>;
  };
  logs: {
    add(l: Omit<LogEntry, "id" | "createdAt">): Promise<void>;
    list(limit: number): Promise<LogEntry[]>;
  };
}

/** 메모리 저장소 (테스트용) */
export function memoryRepo(): Repo {
  const users: User[] = [];
  const designs: DesignRecord[] = [];
  const versions: { designId: string; doc: DesignDoc; savedAt: Date }[] = [];
  const logs: LogEntry[] = [];
  const hourChecks: HourCheckRecord[] = [];
  let seq = 0;
  const id = () => `m${++seq}`;
  const summary = ({ doc: _doc, ...rest }: DesignRecord): DesignSummary => rest;
  const byUpdated = (a: { updatedAt: Date }, b: { updatedAt: Date }) => b.updatedAt.getTime() - a.updatedAt.getTime();

  return {
    users: {
      findBySchoolKey: async (key) => users.find((u) => u.schoolKey === key) ?? null,
      findById: async (uid) => users.find((u) => u.id === uid) ?? null,
      create: async (u) => {
        const user = { ...u, id: id() };
        users.push(user);
        return user;
      },
      update: async (uid, patch) => {
        const u = users.find((x) => x.id === uid);
        if (u) Object.assign(u, patch);
      },
      list: async () => [...users].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    },
    designs: {
      create: async (d) => {
        const rec = structuredClone({ ...d, id: id() });
        designs.push(rec);
        return structuredClone(rec);
      },
      get: async (did) => structuredClone(designs.find((d) => d.id === did) ?? null),
      update: async (did, patch) => {
        const d = designs.find((x) => x.id === did);
        if (d) Object.assign(d, structuredClone(patch));
      },
      delete: async (did) => {
        const i = designs.findIndex((d) => d.id === did);
        if (i >= 0) designs.splice(i, 1);
      },
      listByOwner: async (ownerId) => designs.filter((d) => d.ownerId === ownerId).map(summary).sort(byUpdated),
      listAll: async () => designs.map(summary).sort(byUpdated),
      findSameActivity: async (schoolName, schoolYear, name, excludeId) => {
        const d = designs.find(
          (x) => x.schoolName === schoolName && x.schoolYear === schoolYear && nameKey(x.name) === nameKey(name) && x.id !== excludeId,
        );
        return d ? summary(d) : null;
      },
      saveVersion: async (designId, doc) => {
        versions.push({ designId, doc: structuredClone(doc), savedAt: new Date() });
      },
    },
    hourChecks: {
      listByOwner: async (ownerId) => structuredClone(hourChecks.filter((h) => h.ownerId === ownerId)),
      upsert: async (r) => {
        const i = hourChecks.findIndex((h) => h.ownerId === r.ownerId && h.grade === r.grade && h.schoolYear === r.schoolYear);
        if (i >= 0) hourChecks[i] = structuredClone(r);
        else hourChecks.push(structuredClone(r));
      },
    },
    logs: {
      add: async (l) => {
        logs.push({ ...l, id: id(), createdAt: new Date() });
      },
      list: async (limit) => [...logs].reverse().slice(0, limit),
    },
  };
}
