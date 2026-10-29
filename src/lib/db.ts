import "server-only";
import { MongoClient, type Db } from "mongodb";
import { env } from "./env";

// 개발 중 파일을 고칠 때마다 연결이 새로 생기지 않도록 전역에 보관한다.
const globalForMongo = globalThis as unknown as { _mongoClient?: Promise<MongoClient> };

export function isDbConfigured(): boolean {
  return env.mongodbUri !== "";
}

export async function getDb(): Promise<Db> {
  if (!isDbConfigured()) throw new Error("MONGODB_URI 환경 변수가 설정되지 않았습니다.");
  globalForMongo._mongoClient ??= new MongoClient(env.mongodbUri, {
    serverSelectionTimeoutMS: 8000,
  }).connect();
  const client = await globalForMongo._mongoClient.catch((e) => {
    globalForMongo._mongoClient = undefined;
    throw e;
  });
  return client.db(env.mongodbDb);
}
