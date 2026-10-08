import type { CupDef } from '@offside/contracts/cup';
import { asc } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { cups } from '../db/schema.js';

// T-11-145 대회 일정은 D1 cups 테이블이다(관리자 API로 연다). 행이 몇 개 안 돼서 요청마다 읽는다 — 새 회차가 바로 보인다.
export type CupRow = typeof cups.$inferSelect;

export const toCupDef = (r: CupRow): CupDef => ({
  id: r.id,
  season: r.season,
  edition: r.edition,
  opensAt: r.opensAt,
  closesAt: r.closesAt,
  drawAt: r.drawAt,
  rounds: JSON.parse(r.roundsJson) as string[],
  capacity: r.capacity,
  minFilled: r.minFilled,
});

/** 모든 대회(접수 시작 순). */
export const cupSchedule = async (db: Db): Promise<CupDef[]> =>
  (await db.select().from(cups).orderBy(asc(cups.opensAt))).map(toCupDef);
