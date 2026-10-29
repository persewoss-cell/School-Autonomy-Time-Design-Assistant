import "server-only";
import { ObjectId, type Db, type WithId, type Document } from "mongodb";
import type { DesignRecord, DesignSummary, LogEntry, Repo, User } from "./repo";

/**
 * MongoDB 저장소. 컬렉션: users, designs, designVersions, activityLogs
 * (설계 제안서 docs/PLAN.md의 데이터 구조)
 */

const MAX_VERSIONS = 20;

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
    db.collection("users").createIndex({ email: 1 }, { unique: true }),
    db.collection("designs").createIndex({ ownerId: 1, updatedAt: -1 }),
    db.collection("designs").createIndex({ type: 1, schoolName: 1, schoolYear: 1, name: 1 }),
    db.collection("designVersions").createIndex({ designId: 1, savedAt: -1 }),
    db.collection("activityLogs").createIndex({ createdAt: -1 }),
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

  return {
    users: {
      findByEmail: async (email) => toUser(await users.findOne({ email })),
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
        const filter: Document = { type: "activity", schoolName, schoolYear, name };
        const ex = excludeId ? oid(excludeId) : null;
        if (ex) filter._id = { $ne: ex };
        const d = await designs.findOne(filter, { projection: summaryProjection });
        return d ? toSummary(d) : null;
      },
      saveVersion: async (designId, doc) => {
        await versions.insertOne({ designId, doc, savedAt: new Date() });
        const old = await versions.find({ designId }).sort({ savedAt: -1 }).skip(MAX_VERSIONS).project({ _id: 1 }).toArray();
        if (old.length) await versions.deleteMany({ _id: { $in: old.map((o) => o._id) } });
      },
    },
    logs: {
      add: async (l) => {
        await logs.insertOne({ ...l, createdAt: new Date() });
      },
      list: async (limit) =>
        (await logs.find().sort({ createdAt: -1 }).limit(limit).toArray()).map(({ _id, ...rest }) => ({ ...(rest as Omit<LogEntry, "id">), id: _id.toString() })),
    },
  };
}
