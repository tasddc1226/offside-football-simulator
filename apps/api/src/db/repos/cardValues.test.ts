import { valueFor } from '@offside/contracts/market-value';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cards, careers, careerSeasons } from '../schema.js';
import { createTestD1, syncCards, type TestD1 } from '../../test/d1.js';
import { issueCookie } from '../../test/http.js';
import { CARD_VALUE_RESCAN_KEY, runCardValueRescan } from './cardValues.js';

// T-11-422 카드 기준가를 최고 OVR 시즌 중 가장 비싼 시즌으로 다시 매긴다(이미 생긴 카드).
describe('T-11-422 runCardValueRescan', () => {
  let ctx: TestD1;
  beforeEach(async () => {
    ctx = await createTestD1();
  });
  afterEach(async () => {
    await ctx.dispose();
  });

  const at = '2026-10-15T00:00:00.000Z';
  async function career(profileId: string, peak: number, seasons: [age: number, ovr: number][]) {
    const id = crypto.randomUUID();
    await ctx.db.insert(careers).values({
      id,
      profileId,
      pos: 'FW',
      foot: '오른발',
      type: 'poacher',
      trait: 'late',
      startYear: 2026,
      status: 'retired',
      appVersion: '1.0.0',
      createdAt: at,
      updatedAt: at,
      retiredAt: at,
      retireAge: 35,
      peak,
      legendScore: 300,
      shirtNumber: 9,
      serviceSeason: 1,
    });
    for (const [i, [age, ovr]] of seasons.entries())
      await ctx.db.insert(careerSeasons).values({
        careerId: id,
        year: 2030 + i,
        age,
        club: '테스트 FC',
        clubId: 'pl-1',
        league: '프리미어리그',
        apps: 30,
        goals: 10,
        assists: 5,
        rating: 7,
        rank: '1',
        ovr,
        honorsJson: '[]',
        mil: 0,
        eventsJson: '[]',
        createdAt: at,
      });
    return id;
  }
  const valueOf = async (id: string) =>
    (await ctx.db.select().from(cards)).find((c) => c.careerId === id)?.cardValue;

  it('30세를 넘겨 같은 최고 OVR로 뛴 카드만 29세 시즌 몸값으로 올리고, 끝까지 훑으면 멈춘다', async () => {
    const { profileId } = await issueCookie(ctx);
    const long = await career(profileId, 99, [
      [29, 99],
      [30, 99],
      [33, 99],
      [35, 90],
    ]);
    const once = await career(profileId, 99, [
      [29, 99],
      [30, 95],
    ]);
    // 은퇴 때의 옛 식(최고 OVR 마지막 시즌)으로 적힌 값.
    await syncCards(ctx, valueFor('pl', 99, 33));
    expect(await runCardValueRescan(ctx.env.DB, 1)).toMatchObject({ scanned: 1, done: false });
    expect(await runCardValueRescan(ctx.env.DB, 1)).toMatchObject({ scanned: 1, done: false });
    expect(await runCardValueRescan(ctx.env.DB, 1)).toMatchObject({ scanned: 0, done: true });
    expect(await runCardValueRescan(ctx.env.DB, 1)).toBeNull();
    expect(await valueOf(long)).toBe(valueFor('pl', 99, 29));
    // 최고 OVR 시즌이 하나뿐이면 그대로 둔다.
    expect(await valueOf(once)).toBe(valueFor('pl', 99, 33));
    const meta = await ctx.env.DB.prepare('SELECT value FROM app_meta WHERE key = ?')
      .bind(CARD_VALUE_RESCAN_KEY)
      .first<{ value: string }>();
    expect(JSON.parse(meta!.value)).toMatchObject({ done: true });
  });

  it('새 값이 더 작으면 내리지 않는다', async () => {
    const { profileId } = await issueCookie(ctx);
    const id = await career(profileId, 90, [
      [31, 90],
      [33, 90],
    ]);
    await syncCards(ctx, valueFor('pl', 90, 25));
    expect(await runCardValueRescan(ctx.env.DB)).toMatchObject({ raised: 0, done: true });
    expect(await valueOf(id)).toBe(valueFor('pl', 90, 25));
  });
});
