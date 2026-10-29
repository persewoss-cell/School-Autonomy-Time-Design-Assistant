import type { DesignDoc } from "@/domain/types";

/**
 * 저장소 인터페이스. 실제 서비스는 MongoDB(mongoRepo), 테스트는 메모리(memoryRepo)를 쓴다.
 * 학생 개인정보는 저장하지 않는다. 프롬프트·AI 답 원문도 저장하지 않는다.
 */

export type Role = "teacher" | "admin";
export type UserStatus = "pending" | "active" | "blocked";

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  schoolName: string;
  role: Role;
  status: UserStatus;
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
  schoolName: string;
  schoolYear: string;
  errorCount: number;
  warningCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export type LogKind = "signup" | "login" | "login_fail" | "save" | "delete" | "download" | "parse_fail";

export interface LogEntry {
  id: string;
  kind: LogKind;
  userId?: string;
  email?: string;
  designId?: string;
  /** 짧은 설명 (예: 답 읽기 실패 단계와 이유). 원문은 저장하지 않음 */
  detail?: string;
  createdAt: Date;
}

export type DesignSummary = Omit<DesignRecord, "doc">;

export interface Repo {
  users: {
    findByEmail(email: string): Promise<User | null>;
    findById(id: string): Promise<User | null>;
    create(u: Omit<User, "id">): Promise<User>;
    update(id: string, patch: Partial<Omit<User, "id" | "email">>): Promise<void>;
    list(): Promise<User[]>;
  };
  designs: {
    create(d: Omit<DesignRecord, "id">): Promise<DesignRecord>;
    get(id: string): Promise<DesignRecord | null>;
    update(id: string, patch: Partial<Omit<DesignRecord, "id" | "ownerId" | "createdAt">>): Promise<void>;
    delete(id: string): Promise<void>;
    listByOwner(ownerId: string): Promise<DesignSummary[]>;
    listAll(): Promise<DesignSummary[]>;
    /** 같은 학교·같은 학년도에 같은 이름의 활동이 있는지 */
    findSameActivity(schoolName: string, schoolYear: string, name: string, excludeId?: string): Promise<DesignSummary | null>;
    saveVersion(designId: string, doc: DesignDoc): Promise<void>;
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
  let seq = 0;
  const id = () => `m${++seq}`;
  const summary = ({ doc: _doc, ...rest }: DesignRecord): DesignSummary => rest;
  const byUpdated = (a: { updatedAt: Date }, b: { updatedAt: Date }) => b.updatedAt.getTime() - a.updatedAt.getTime();

  return {
    users: {
      findByEmail: async (email) => users.find((u) => u.email === email) ?? null,
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
          (x) => x.type === "activity" && x.schoolName === schoolName && x.schoolYear === schoolYear && x.name === name && x.id !== excludeId,
        );
        return d ? summary(d) : null;
      },
      saveVersion: async (designId, doc) => {
        versions.push({ designId, doc: structuredClone(doc), savedAt: new Date() });
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
