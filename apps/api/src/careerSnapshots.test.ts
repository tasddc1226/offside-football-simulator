import { HofDetailResponseSchema, successEnvelope } from '@offside/contracts';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import {
  deleteSnapshots,
  runSnapshotOffload,
  snapshotKeyOf,
  SNAPSHOT_OFFLOAD_STATE_KEY,
} from './careerSnapshots.js';
import { assessInfraHealth, D1_LIMIT_BYTES } from './cron/infraHealth.js';
import { careers } from './db/schema.js';
import { createTestD1, type TestD1 } from './test/d1.js';
import { issueCookie, putJson, putSeasonsFor } from './test/http.js';
import { DAY_MS } from './time.js';

// T-11-311 은퇴 상세 스냅샷은 R2에 두고 D1에는 키만 둔다.
const A = '0c000000-0000-4000-8000-0000000003a1';
const B = '0c000000-0000-4000-8000-0000000003b2';
const summary = {
  retireAge: 34,
  peak: 88,
  legendScore: 420,
  apps: 300,
  goals: 120,
  assists: 40,
  trophies: 3,
  awards: 1,
  caps: 10,
  ballon: 0,
  lastClub: '테스트 FC',
};
const snapshot = {
  titles: [{ id: 'goals100', year: 2034 }],
  number: 7,
  pos: 'FW',
  age: 34,
  peak: 88,
  lastClub: '테스트 FC',
  lastClubId: 'pl-15',
  career: [
    {
      year: 2026,
      age: 18,
      club: '테스트 FC',
      clubId: 'pl-15',
      league: '고교리그',
      apps: 20,
      goals: 10,
      assists: 3,
      cs: 0,
      rating: 7.2,
      rank: 1,
      ovr: 60,
      honors: ['고교리그 우승'],
      ch: ['goals'],
    },
  ],
  trophies: [{ year: 2026, t: '고교리그 우승', club: '테스트 FC', clubId: 'pl-15' }],
  awards: [],
  ballon: [],
  nat: { caps: 30 },
  storyLog: [],
  miles: [{ year: 2026, t: '데뷔' }],
  style: {
    from: 18,
    betOdds: 610,
    bets: 12,
    betWins: 7,
    longshots: 3,
    longshotWins: 1,
    safe: 2,
    sure: 5,
    best: { id: 'derby', p: 0.22 },
    moves: 2,
    tierUp: 2,
    tierDown: 0,
    payFirst: 0,
    loyal: 1,
    snubUp: 0,
  },
};

describe('은퇴 상세 스냅샷 R2 (T-11-311)', () => {
  let ctx: TestD1;
  let cookie: string;
  beforeEach(async () => {
    ctx = await createTestD1();
    cookie = (await issueCookie(ctx)).cookie;
    for (const id of [A, B]) {
      await putSeasonsFor(ctx.env, cookie, id, summary);
      await ctx.env.BACKUP!.delete(snapshotKeyOf(ctx.env.ENVIRONMENT, id));
    }
  });
  afterEach(() => ctx.dispose());

  const retire = (id: string, title?: string) =>
    putJson(ctx, cookie, `/v1/careers/${id}/retirement`, {
      ...summary,
      publicName: null,
      snapshot,
      ...(title ? { title } : {}),
    });
  const row = async (id: string) =>
    (
      await ctx.db
        .select({ json: careers.snapshotJson, key: careers.snapshotKey, title: careers.title })
        .from(careers)
        .where(eq(careers.id, id))
    )[0]!;
  const detail = async (id: string) =>
    successEnvelope(HofDetailResponseSchema).parse(
      await (await createApp().request(`/v1/hof/${id}`, {}, ctx.env)).json(),
    ).data;

  it('은퇴하면 상세를 R2에 쓰고 D1에는 키만 둔다 — 상세 · 대표 칭호 확인은 R2를 읽는다', async () => {
    expect((await retire(A)).status).toBe(200);
    const r = await row(A);
    expect(r.json).toBeNull();
    expect(r.key).toBe(snapshotKeyOf(ctx.env.ENVIRONMENT, A));
    expect(JSON.parse(await (await ctx.env.BACKUP!.get(r.key!))!.text()).career).toHaveLength(1);
    const d = await detail(A);
    expect(d.entry.hasDetail).toBe(true);
    expect(d.snapshot?.career[0]?.club).toBe('테스트 FC');
    // 재전송은 첫 상세를 덮지 않고, 대표 칭호는 R2 상세의 획득 칭호로만 바꾼다.
    expect((await retire(A, 'goals100')).status).toBe(200);
    expect((await row(A)).title).toBe('goals100');
    expect((await retire(A, 'ballon1')).status).toBe(200);
    expect((await row(A)).title).toBe('goals100');
  });

  it('R2를 끄면 예전처럼 D1에 두고, 5분 작업이 나중에 R2로 옮긴다', async () => {
    ctx.env.SNAPSHOT_R2_DISABLED = '1';
    await retire(A);
    await retire(B);
    expect((await row(A)).key).toBeNull();
    expect((await row(A)).json).not.toBeNull();
    // 꺼져 있으면 옮기지 않는다.
    expect(await runSnapshotOffload(ctx.env)).toBeNull();
    delete ctx.env.SNAPSHOT_R2_DISABLED;
    expect(await runSnapshotOffload(ctx.env, 1)).toMatchObject({ moved: 1, done: false });
    expect(await runSnapshotOffload(ctx.env, 1)).toMatchObject({ moved: 1, done: false });
    expect(await runSnapshotOffload(ctx.env, 1)).toMatchObject({ moved: 0, done: true });
    expect(await runSnapshotOffload(ctx.env, 1)).toBeNull();
    const state = await ctx.env.DB.prepare('SELECT value FROM app_meta WHERE key = ?')
      .bind(SNAPSHOT_OFFLOAD_STATE_KEY)
      .first<{ value: string }>();
    expect(JSON.parse(state!.value)).toMatchObject({ done: true });
    for (const id of [A, B]) {
      expect(await row(id)).toMatchObject({ json: null, key: snapshotKeyOf('local', id) });
      expect((await detail(id)).snapshot?.career).toHaveLength(1);
    }
  });

  it('계정 삭제로 지운 커리어의 R2 상세를 지운다', async () => {
    await retire(A);
    const key = (await row(A)).key!;
    await deleteSnapshots(ctx.env, [A, B]);
    expect(await ctx.env.BACKUP!.get(key)).toBeNull();
  });
});

describe('D1 용량 예측 (T-11-311)', () => {
  it('증가 속도는 최근 3일 표본으로 잰다', () => {
    const now = Date.UTC(2026, 9, 16);
    const size = D1_LIMIT_BYTES * 0.5;
    // 6일 전에는 빨리 늘었지만(정리 전) 최근 3일은 하루 0.5%씩 늘었다.
    const samples = [
      { at: now - 6 * DAY_MS, sizeBytes: D1_LIMIT_BYTES * 0.3 },
      { at: now - 3 * DAY_MS, sizeBytes: size - D1_LIMIT_BYTES * 0.015 },
    ];
    const h = assessInfraHealth(now, size, samples, null, null, false);
    expect(h.daysToLimit).toBeCloseTo(100);
    expect(h.issues).not.toContain('d1-storage-less-than-30-days');
  });
});
