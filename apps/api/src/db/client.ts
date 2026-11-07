import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema.js';

export function createDb(d1: D1Database | D1DatabaseSession) {
  // Drizzle's D1 type predates Sessions API. Its adapter uses prepare/batch only,
  // both supplied by D1DatabaseSession; exec/dump/withSession are not invoked.
  return drizzle(d1 as D1Database, { schema });
}

export type Db = ReturnType<typeof createDb>;

/**
 * T-11-662 게임 DB(DB)에 짝지은 운영 기록 DB(OPS_DB). 요청 횟수 제한처럼 운영 기록 표만 쓰는 저장소 함수는 넘겨받은 게임 DB에서
 * 짝을 찾아 쓴다(호출부마다 두 DB를 넘기지 않게). 짝이 없으면(OPS_DB가 없는 환경) 게임 DB 그대로다.
 */
const opsLink = new WeakMap<object, Db>();
export function linkOps(core: Db, ops: Db): Db {
  opsLink.set(core, ops);
  return core;
}
export const opsOf = (db: Db): Db => opsLink.get(db) ?? db;
