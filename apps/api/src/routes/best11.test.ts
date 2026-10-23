import { Best11ResponseSchema, successEnvelope } from '@offside/contracts';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import {
  offerRetiredBest11,
  readBest11,
  recomputeBest11,
  runBest11Daily,
} from '../db/repos/best11.js';
import { storedSeasonsOf } from '../db/repos/careers.js';
import { best11Candidates, best11Changes, careerSeasons, careers } from '../db/schema.js';
import { createTestD1, spyDb, type TestD1 } from '../test/d1.js';
import { issueCookie } from '../test/http.js';

const RETIRED = '2026-10-20T03:00:00.000Z';
const NOW = '2026-10-20T03:00:01.000Z';

let ctx: TestD1;
beforeEach(async () => {
  ctx = await createTestD1();
});
afterEach(async () => {
  await ctx.dispose();
});

type Opts = {
  dpos: string;
  rating?: number;
  honors?: string[];
  league?: string;
  name?: string | null;
  season?: number;
  seasons?: number;
};

/** 시즌 1 은퇴 선수 하나(프리미어리그 시즌 n개 · 시즌마다 60경기). */
async function addCareer(profileId: string, o: Opts): Promise<string> {
  const id = crypto.randomUUID();
  const t = '2026-10-10T00:00:00.000Z';
  await ctx.db.insert(careers).values({
    id,
    profileId,
    pos: o.dpos === 'GK' ? 'GK' : 'FW',
    dpos: o.dpos,
    foot: '오른발',
    type: 'poacher',
    trait: 'late',
    startYear: 2026,
    status: 'retired',
    appVersion: '1.0.0',
    createdAt: t,
    updatedAt: t,
    retiredAt: RETIRED,
    retireAge: 38,
    peak: 90,
    legendScore: 1000 + Math.round((o.rating ?? 7) * 100),
    publicName: o.name === undefined ? `선수 ${id.slice(0, 4)}` : o.name,
    serviceSeason: o.season ?? 1,
  });
  const n = o.seasons ?? 6;
  for (let i = 0; i < n; i++)
    await ctx.db.insert(careerSeasons).values({
      careerId: id,
      year: 2026 + i,
      age: 22 + i,
      club: '테스트 FC',
      league: o.league ?? '프리미어리그',
      apps: 60,
      goals: 20,
      assists: 10,
      rating: o.rating ?? 7,
      cs: 20,
      rank: '1',
      ovr: 85,
      honorsJson: JSON.stringify(i === 0 ? (o.honors ?? []) : []),
      mil: 0,
      eventsJson: '[]',
      createdAt: t,
    });
  return id;
}

async function offer(id: string) {
  const seasons = (await storedSeasonsOf(ctx.db, [id])).get(id) ?? [];
  const [row] = await ctx.db.select({ dpos: careers.dpos }).from(careers).where(eq(careers.id, id));
  return offerRetiredBest11(ctx.db, { id, dpos: row!.dpos }, seasons, NOW);
}

async function get(season = 1) {
  const res = await createApp().request(`/v1/best11?season=${season}`, {}, ctx.env);
  expect(res.status).toBe(200);
  return successEnvelope(Best11ResponseSchema).parse(await res.json()).data;
}

describe('T-11-463 시즌 BEST 11', () => {
  it('자격을 갖춘 공개 은퇴가 자리에 오르고, 더 나은 은퇴가 오면 자리 주인이 바뀐다', async () => {
    const a = await issueCookie(ctx);
    const b = await issueCookie(ctx);
    const first = await addCareer(a.profileId, { dpos: 'ST', rating: 7 });
    expect(await offer(first)).toBe(1);
    let data = await get();
    expect(data.finalAt).toBeNull();
    expect(data.slots.find((s) => s.slot === 'ST')?.player?.careerId).toBe(first);
    expect(data.slots.find((s) => s.slot === 'GK')?.player).toBeNull();

    const better = await addCareer(b.profileId, {
      dpos: 'CF',
      rating: 8,
      honors: ['발롱도르', '득점왕'],
    });
    expect(await offer(better)).toBe(1);
    data = await get();
    const st = data.slots.find((s) => s.slot === 'ST')!;
    expect(st.player?.careerId).toBe(better);
    // 둘 다 우승이 없어 팀 성과는 0, 개인 활약 · 개인 수상 1위라 50 + 20.
    expect(st.player?.index).toBe(70);
    expect(st.player?.facts).toMatchObject({ ballon: 1, posAwards: 1, apps: 360 });
    const ranking = data.rankings.find((r) => r.slot === 'ST')!.entries;
    expect(ranking.map((e) => e.careerId)).toEqual([better, first]);
    expect(ranking[0]).toMatchObject({ held: 'xi', at: 'ST' });
    expect(data.changes.map((c) => [c.slot, c.out])).toEqual([
      ['ST', expect.any(String)],
      ['ST', null],
    ]);
  });

  it('한 구단주는 한 자리만: 같은 구단주의 두 번째 선수는 held=owner로 순위표에만 남는다', async () => {
    const a = await issueCookie(ctx);
    const b = await issueCookie(ctx);
    const star = await addCareer(a.profileId, { dpos: 'ST', rating: 8.5, honors: ['발롱도르'] });
    const sameOwnerWinger = await addCareer(a.profileId, { dpos: 'LW', rating: 8 });
    const other = await addCareer(b.profileId, { dpos: 'LW', rating: 7 });
    for (const id of [star, sameOwnerWinger, other]) await offer(id);
    const data = await get();
    expect(data.slots.find((s) => s.slot === 'ST')?.player?.careerId).toBe(star);
    // 윙어 1위는 같은 구단주라 빠지고, 다른 구단주의 2위가 LW에 오른다(W는 좌우 어느 쪽도 아니라 LW · RW만 본다).
    expect(data.slots.find((s) => s.slot === 'LW')?.player?.careerId).toBe(other);
    const lw = data.rankings.find((r) => r.slot === 'LW')!.entries;
    expect(lw.find((e) => e.careerId === sameOwnerWinger)).toMatchObject({
      held: 'owner',
      at: null,
    });
  });

  it('익명 · 자격 미달 · 다른 시즌 · 마감 뒤 은퇴는 후보가 되지 않는다', async () => {
    const a = await issueCookie(ctx);
    const anon = await addCareer(a.profileId, { dpos: 'GK', name: null });
    const short = await addCareer(a.profileId, { dpos: 'GK', seasons: 4 });
    const preseason = await addCareer(a.profileId, { dpos: 'GK', season: 0 });
    for (const id of [anon, short, preseason]) expect(await offer(id)).toBeNull();
    expect(await ctx.db.select().from(best11Candidates)).toEqual([]);
  });

  it('숨김 처리된 후보는 다시 채울 때 빠지고 다음 순위가 자리를 잇는다', async () => {
    const a = await issueCookie(ctx);
    const b = await issueCookie(ctx);
    const top = await addCareer(a.profileId, { dpos: 'GK', rating: 8 });
    const next = await addCareer(b.profileId, { dpos: 'GK', rating: 7 });
    await offer(top);
    await offer(next);
    expect((await readBest11(ctx.db, 1)).slots[0]?.player?.careerId).toBe(top);
    await ctx.db.update(careers).set({ hidden: 1 }).where(eq(careers.id, top));
    expect(await recomputeBest11(ctx.db, 1, NOW)).toBe(true);
    expect((await readBest11(ctx.db, 1)).slots[0]?.player?.careerId).toBe(next);
    expect((await ctx.db.select().from(best11Candidates)).map((c) => c.careerId)).not.toContain(
      top,
    );
  });

  it('확정한 시즌은 새 은퇴 · 다시 채우기에도 바뀌지 않는다', async () => {
    const a = await issueCookie(ctx);
    const b = await issueCookie(ctx);
    const keep = await addCareer(a.profileId, { dpos: 'CM', rating: 7 });
    await offer(keep);
    await recomputeBest11(ctx.db, 1, NOW, true);
    const late = await addCareer(b.profileId, { dpos: 'CM', rating: 9, honors: ['발롱도르'] });
    expect(await offer(late)).toBeNull();
    const data = await get();
    expect(data.finalAt).toBe(NOW);
    expect(data.slots.find((s) => s.slot === 'CM')?.player?.careerId).toBe(keep);
    expect(await ctx.db.select().from(best11Changes)).toHaveLength(1);
  });

  it('매일 단계가 은퇴 PUT에서 빠진 후보(이름을 나중에 공개)를 채운다', async () => {
    const a = await issueCookie(ctx);
    const missed = await addCareer(a.profileId, { dpos: 'DM', rating: 7.5 });
    let cursor: Parameters<typeof runBest11Daily>[2];
    for (let i = 0; i < 10; i++) {
      const r = await runBest11Daily(ctx.db, NOW, cursor);
      cursor = r.cursor;
      if (r.done) break;
    }
    expect((await readBest11(ctx.db, 1)).slots.find((s) => s.slot === 'DM')?.player?.careerId).toBe(
      missed,
    );
  });

  it('공개 조회는 쿠키가 있어도 세션 · 프로필을 읽지 않는다', async () => {
    const a = await issueCookie(ctx);
    await offer(await addCareer(a.profileId, { dpos: 'ST' }));
    const { DB, seen } = spyDb(ctx.env.DB);
    const res = await createApp().request(
      '/v1/best11?season=1',
      { headers: { Cookie: a.cookie } },
      { ...ctx.env, DB },
    );
    expect(res.status).toBe(200);
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.filter((q) => /"sessions"|"profiles"/.test(q))).toEqual([]);
  });
});
