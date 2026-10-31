import "server-only";
import { ObjectId, type Db, type WithId, type Document } from "mongodb";
import { nameKey } from "@/validation/names";
import { MAX_VERSIONS, type DesignRecord, type DesignSummary, type ExampleFile, type HourCheckRecord, type LogEntry, type Repo, type User } from "./repo";

/**
 * MongoDB 저장소. 컬렉션: users, designs, designVersions, hourChecks, activityLogs
 * (설계 제안서 docs/PLAN.md의 데이터 구조)
 */


function toUser(d: WithId<Document> | null): User | null {
  if (!d) return null;
  const { _id, ...rest } = d;
  return { ...(rest as Omit<User, "id">), id: _id.toString() };
}
function toDesign(d: WithId<Document> | null): DesignRecord | null {
  if (!d) return null;
  const { _id, ...rest } = d;
  return { ...(rest as Omit<DesignRecord, "id">), id: _id.toString() };
}
function toSummary(d: WithId<Document>): DesignSummary {
  const { _id, doc: _doc, ...rest } = d;
  return { ...(rest as Omit<DesignSummary, "id">), id: _id.toString() };
}
const oid = (id: string) => (ObjectId.isValid(id) ? new ObjectId(id) : null);
const summaryProjection = { doc: 0 } as const;

let indexesReady: Promise<unknown> | null = null;
function ensureIndexes(db: Db) {
  indexesReady ??= Promise.all([
    // 예전(이메일 가입) 인덱스가 남아 있으면 이메일 없는 계정이 저장되지 않으므로 지운다
    db.collection("users").dropIndex("email_1").catch(() => {}),
    db.collection("users").createIndex({ schoolKey: 1 }, { unique: true, partialFilterExpression: { schoolKey: { $type: "string" } } }),
    db.collection("designs").createIndex({ ownerId: 1, updatedAt: -1 }),
    db.collection("designs").createIndex({ type: 1, schoolName: 1, schoolYear: 1, name: 1 }),
    db.collection("designVersions").createIndex({ designId: 1, savedAt: -1 }),
    // 이용 기록은 1년 지나면 MongoDB가 알아서 지운다 (사용자 결정, 2026-10-31). 예전 일반 인덱스는 지우고 TTL 인덱스로
    db.collection("activityLogs").dropIndex("createdAt_-1").catch(() => {}),
    db.collection("activityLogs").createIndex({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 }),
    db.collection("exampleFiles").createIndex({ uploadedAt: -1 }),
    // 학년도별로 저장하므로 예전 (ownerId, grade) 고유 인덱스는 지운다
    db.collection("hourChecks").dropIndex("ownerId_1_grade_1").catch(() => {}),
    db.collection("hourChecks").createIndex({ ownerId: 1, schoolYear: 1, grade: 1 }),
  ]).catch((e) => {
    indexesReady = null;
    throw e;
  });
  return indexesReady;
}

export function mongoRepo(db: Db): Repo {
  void ensureIndexes(db).catch(() => {});
  const users = db.collection("users");
  const designs = db.collection("designs");
  const versions = db.collection("designVersions");
  const logs = db.collection("activityLogs");
  const hourChecks = db.collection("hourChecks");
  const exampleFiles = db.collection("exampleFiles");
  const toExample = ({ _id, data: _d, ...rest }: WithId<Document>): ExampleFile => ({ ...(rest as Omit<ExampleFile, "id">), id: _id.toString() });

  return {
    users: {
      findBySchoolKey: async (schoolKey) => toUser(await users.findOne({ schoolKey })),
      findById: async (id) => {
        const _id = oid(id);
        return _id ? toUser(await users.findOne({ _id })) : null;
      },
      create: async (u) => {
        const r = await users.insertOne({ ...u });
        return { ...u, id: r.insertedId.toString() };
      },
      update: async (id, patch) => {
        const _id = oid(id);
        if (_id) await users.updateOne({ _id }, { $set: patch });
      },
      list: async () => (await users.find().sort({ createdAt: -1 }).toArray()).map((d) => toUser(d)!),
      delete: async (id) => {
        const _id = oid(id);
        if (_id) await users.deleteOne({ _id });
      },
    },
    designs: {
      create: async (d) => {
        const r = await designs.insertOne({ ...d });
        return { ...d, id: r.insertedId.toString() };
      },
      get: async (id) => {
        const _id = oid(id);
        return _id ? toDesign(await designs.findOne({ _id })) : null;
      },
      update: async (id, patch) => {
        const _id = oid(id);
        if (_id) await designs.updateOne({ _id }, { $set: patch });
      },
      delete: async (id) => {
        const _id = oid(id);
        if (!_id) return;
        await designs.deleteOne({ _id });
        await versions.deleteMany({ designId: id });
      },
      listByOwner: async (ownerId) =>
        (await designs.find({ ownerId }, { projection: summaryProjection }).sort({ updatedAt: -1 }).toArray()).map(toSummary),
      listAll: async () => (await designs.find({}, { projection: summaryProjection }).sort({ updatedAt: -1 }).limit(1000).toArray()).map(toSummary),
      findSameActivity: async (schoolName, schoolYear, name, excludeId) => {
        // 띄어쓰기는 무시하고 비교 (같은 학교·학년도 설계만 불러와 코드로 비교)
        const filter: Document = { schoolName, schoolYear };
        const ex = excludeId ? oid(excludeId) : null;
        if (ex) filter._id = { $ne: ex };
        const list = await designs.find(filter, { projection: summaryProjection }).toArray();
        const d = list.find((x) => nameKey(String(x.name ?? "")) === nameKey(name));
        return d ? toSummary(d) : null;
      },
      saveVersion: async (designId, doc) => {
        await versions.insertOne({ designId, doc, savedAt: new Date() });
        const old = await versions.find({ designId }).sort({ savedAt: -1 }).skip(MAX_VERSIONS).project({ _id: 1 }).toArray();
        if (old.length) await versions.deleteMany({ _id: { $in: old.map((o) => o._id) } });
      },
      deleteByOwner: async (ownerId) => {
        const ids = (await designs.find({ ownerId }).project({ _id: 1 }).toArray()).map((d) => d._id.toString());
        if (ids.length) await versions.deleteMany({ designId: { $in: ids } });
        return (await designs.deleteMany({ ownerId })).deletedCount;
      },
    },
    hourChecks: {
      listByOwner: async (ownerId) =>
        (await hourChecks.find({ ownerId }).toArray()).map(({ _id: _omit, ...rest }) => rest as HourCheckRecord),
      upsert: async (r) => {
        await hourChecks.updateOne({ ownerId: r.ownerId, grade: r.grade, schoolYear: r.schoolYear }, { $set: r }, { upsert: true });
      },
      deleteByOwner: async (ownerId) => {
        await hourChecks.deleteMany({ ownerId });
      },
    },
    logs: {
      add: async (l) => {
        await logs.insertOne({ ...l, createdAt: new Date() });
      },
      list: async (limit, skip = 0) =>
        (await logs.find().sort({ createdAt: -1 }).skip(skip).limit(limit).toArray()).map(({ _id, ...rest }) => ({ ...(rest as Omit<LogEntry, "id">), id: _id.toString() })),
      count: async () => logs.countDocuments(),
    },
    storageBytes: async () => {
      const s = await db.command({ dbStats: 1 });
      return Number(s.dataSize ?? 0) + Number(s.indexSize ?? 0);
    },
    examples: {
      list: async () => (await exampleFiles.find({}, { projection: { data: 0 } }).sort({ uploadedAt: -1 }).toArray()).map(toExample),
      getFile: async (id) => {
        const _id = oid(id);
        const d = _id ? await exampleFiles.findOne({ _id }) : null;
        if (!d) return null;
        const data = d.data as { buffer: ArrayBuffer | Buffer } | Buffer;
        return { meta: toExample(d), data: Buffer.isBuffer(data) ? data : Buffer.from((data as { buffer: Buffer }).buffer) };
      },
      create: async (meta, data) => {
        const r = await exampleFiles.insertOne({ ...meta, data });
        return { ...meta, id: r.insertedId.toString() };
      },
      delete: async (id) => {
        const _id = oid(id);
        if (_id) await exampleFiles.deleteOne({ _id });
      },
    },
  };
}
