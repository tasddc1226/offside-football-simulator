import { describe, expect, it, vi } from 'vitest';
import type { Db } from '../client.js';
import { insertAnalyticsEvents, type InsertAnalyticsEventInput } from './analyticsEvents.js';

function makeInputs(count: number): InsertAnalyticsEventInput[] {
  return Array.from({ length: count }, (_, i) => ({
    clientId: 'clt_chunk_test',
    profileId: null,
    name: 'screen_viewed',
    props: { screenId: 'SCR-001', careerPhase: 'NONE' },
    clientTs: 1_757_000_000_000 + i,
    receivedAt: '2026-09-04T00:00:00.000Z',
  }));
}

/**
 * T-2-015: Miniflare 로컬 SQLite는 D1의 문장당 바인딩 변수 100개 상한을 재현하지 않으므로 재현을
 * 시도하지 않는다. 대신 db.insert를 wrap해 몇 문장으로, 몇 행씩 나뉘어 호출되는지만 단언한다.
 */
function createInsertSpy() {
  const chunkSizes: number[] = [];
  const values = vi.fn((rows: unknown[]) => {
    chunkSizes.push(rows.length);
    return Promise.resolve();
  });
  const insert = vi.fn(() => ({ values }));
  const db = { insert } as unknown as Db;
  return { db, chunkSizes, insert };
}

describe('insertAnalyticsEvents chunking (T-2-015)', () => {
  it('50건을 14·14·14·8 네 문장으로 나눠 순차 insert한다', async () => {
    const { db, chunkSizes, insert } = createInsertSpy();
    await insertAnalyticsEvents(db, makeInputs(50));
    expect(chunkSizes).toEqual([14, 14, 14, 8]);
    expect(insert).toHaveBeenCalledTimes(4);
  });

  it('1건이면 문장 1개', async () => {
    const { db, chunkSizes, insert } = createInsertSpy();
    await insertAnalyticsEvents(db, makeInputs(1));
    expect(chunkSizes).toEqual([1]);
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it('0건이면 insert를 호출하지 않는다', async () => {
    const { db, chunkSizes, insert } = createInsertSpy();
    await insertAnalyticsEvents(db, makeInputs(0));
    expect(chunkSizes).toEqual([]);
    expect(insert).not.toHaveBeenCalled();
  });
});
