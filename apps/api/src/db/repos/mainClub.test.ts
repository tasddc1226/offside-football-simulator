import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { appMeta, cards, careers, careerSeasons } from '../schema.js';
import { createTestD1, type TestD1 } from '../../test/d1.js';
import { issueCookie } from '../../test/http.js';
import { MAIN_CLUB_STATE_KEY, mainClubSet, runMainClubBackfill } from './mainClub.js';

const NOW = '2026-10-23T00:00:00.000Z';

describe('주 리그 · 클럽 (T-11-467)', () => {
  let ctx: TestD1;
  let profileId: string;
  beforeEach(async () => {
    ctx = await createTestD1();
    profileId = (await issueCookie(ctx)).profileId;
  });
  afterEach(async () => {
    await ctx.dispose();
  });

  /** clubs: 시즌마다 [클럽 id(없으면 null), 병역]. */
  async function career(id: string, clubs: [string | null, number?][], card = true) {
    await ctx.db.insert(careers).values({
      id,
      profileId,
      pos: 'FW',
      foot: '오른발',
      type: 'poacher',
      trait: 'late',
      startYear: 2026,
      appVersion: 'test',
      status: 'retired',
      peak: 80,
      createdAt: NOW,
      updatedAt: NOW,
    });
    // D1 바인드 변수 상한(100) 때문에 시즌을 한 줄씩 넣는다.
    for (const [i, [clubId, mil]] of clubs.entries())
      await ctx.db.insert(careerSeasons).values({
        careerId: id,
        year: 2026 + i,
        age: 18 + i,
        club: 'A',
        clubId,
        league: 'L',
        apps: 30,
        goals: 1,
        assists: 1,
        rating: 7,
        rank: '1',
        ovr: 70,
        honorsJson: '[]',
        mil: mil ?? 0,
        eventsJson: '[]',
        createdAt: NOW,
      });
    if (card)
      await ctx.db.insert(cards).values({
        careerId: id,
        ownerId: profileId,
        serviceSeason: 1,
        pos: 'FW',
        peak: 80,
        legendScore: 0,
        retireValue: 0,
        createdAt: NOW,
        updatedAt: NOW,
      });
  }
  const main = async (id: string) =>
    (
      await ctx.db
        .select({ league: careers.mainLeague, club: careers.mainClub })
        .from(careers)
        .where(eq(careers.id, id))
    )[0];

  it('고교 · 대학 · 병역 · 클럽 id 없는 시즌을 빼고 가장 오래 뛴 리그 · 클럽을 센다(같으면 최근)', async () => {
    await career('a', [
      ['hs-0'],
      ['hs-0'],
      ['hs-0'],
      ['uni-1'],
      ['k1-3'],
      ['pl-2'],
      ['pl-5'],
      ['k1-3', 1],
      [null],
      ['ll-1'],
      ['ll-1'],
    ]);
    await ctx.db.update(careers).set(mainClubSet).where(eq(careers.id, 'a'));
    // 리그: pl 2시즌 = ll 2시즌 → 최근(ll). 클럽: ll-1 2시즌.
    expect(await main('a')).toEqual({ league: 'll', club: 'll-1' });
  });

  it('프로 시즌이 없으면 빈 문자열로 둔다', async () => {
    await career('b', [['hs-0'], ['uni-2']]);
    await ctx.db.update(careers).set(mainClubSet).where(eq(careers.id, 'b'));
    expect(await main('b')).toEqual({ league: '', club: '' });
  });

  it('백필은 카드를 조각으로 채우고 다 끝나면 멈춘다', async () => {
    await career('c1', [['pl-1'], ['pl-1']]);
    await career('c2', [['bl-0']]);
    await career('c3', [['sa-4']], false);
    // owner_teams가 없으니 선발 단계는 바로 끝난다.
    expect(await runMainClubBackfill(ctx.env.DB, 200, 1)).toMatchObject({
      phase: 'lineups',
      done: false,
    });
    expect(await runMainClubBackfill(ctx.env.DB, 200, 1)).toMatchObject({
      phase: 'cards',
      careers: 1,
    });
    expect(await main('c1')).toEqual({ league: 'pl', club: 'pl-1' });
    expect(await main('c2')).toEqual({ league: null, club: null });
    await runMainClubBackfill(ctx.env.DB, 200, 1);
    expect(await main('c2')).toEqual({ league: 'bl', club: 'bl-0' });
    expect(await runMainClubBackfill(ctx.env.DB, 200, 1)).toMatchObject({ done: true });
    expect(await runMainClubBackfill(ctx.env.DB, 200, 1)).toBeNull();
    // 카드가 없는 커리어는 건드리지 않는다.
    expect(await main('c3')).toEqual({ league: null, club: null });
    const [state] = await ctx.db.select().from(appMeta).where(eq(appMeta.key, MAIN_CLUB_STATE_KEY));
    expect(JSON.parse(state!.value)).toMatchObject({ done: true });
  });
});
