import {
  ErrorEnvelopeSchema,
  ExchangeClaimResponseSchema,
  ExchangeMeResponseSchema,
  successEnvelope,
} from '@offside/contracts';
import { exchangesAt, type ExchangeDef } from '@offside/contracts/card-exchange-rules';
import { eq, inArray } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cardExchangeClaims,
  cards,
  careers,
  ownerItems,
  ownerTitleProgress,
} from '../db/schema.js';
import { createTestD1, syncCards, type TestD1 } from '../test/d1.js';
import { callJson, issueCookie, issueGoogleCookie } from '../test/http.js';

const MeRes = successEnvelope(ExchangeMeResponseSchema);
const ClaimRes = successEnvelope(ExchangeClaimResponseSchema);
const NOW = '2026-10-20T03:00:00.000Z';
const DPOS = { GK: 'GK', DF: 'CB', MF: 'CM', FW: 'ST' } as const;

let seq = 0;

describe('카드 바치기 과제 (T-11-374)', () => {
  let ctx: TestD1;
  beforeEach(async () => {
    ctx = await createTestD1();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
  });
  afterEach(async () => {
    vi.useRealTimers();
    await ctx.dispose();
  });

  const call = (method: string, path: string, opts?: Parameters<typeof callJson>[3]) =>
    callJson(ctx.env, method, path, opts);
  const idem = (key = `exchange-${++seq}-key`) => ({ 'Idempotency-Key': key });
  const reason = async (res: Response) =>
    (ErrorEnvelopeSchema.parse(await res.json()).error.details as { reason?: string } | undefined)
      ?.reason;
  const easy = (): ExchangeDef => exchangesAt(NOW, 1).find((d) => d.tier === 'easy')!;

  /** 과제 조건에 맞는 은퇴 카드 n장(포지션 · 최고 OVR · 시즌 · 주발을 규칙에서 고른다). */
  async function addCards(profileId: string, def: ExchangeDef, n = def.rule.count) {
    const r = def.rule;
    const pos = r.pos?.[0] ?? 'MF';
    const peak = Math.max(r.peakMin ?? 0, Math.min(r.peakMax ?? 99, 75));
    const ids: string[] = [];
    for (let i = 0; i < n; i++) {
      const id = crypto.randomUUID();
      const at = '2026-10-10T00:00:00.000Z';
      await ctx.db.insert(careers).values({
        id,
        profileId,
        pos,
        dpos: DPOS[pos],
        foot: (r.foot ?? '오른발') as '오른발' | '왼발' | '양발',
        type: 'maker',
        trait: 'late',
        startYear: 2026,
        status: 'retired',
        appVersion: '1.0.0',
        createdAt: at,
        updatedAt: at,
        retiredAt: at,
        retireAge: 34,
        peak,
        legendScore: 300,
        apps: 300,
        nation: '대한민국',
        serviceSeason: typeof r.seasons?.[0] === 'number' ? r.seasons[0] : 1,
        value: 1_000_000,
      });
      ids.push(id);
    }
    await syncCards(ctx, 500_000);
    return ids;
  }
  const claim = (cookie: string, id: string, careerIds: string[], key?: string) =>
    call('POST', `/v1/exchanges/${id}/claim`, { cookie, headers: idem(key), body: { careerIds } });
  const owned = async (ids: string[]) =>
    (await ctx.db.select().from(cards).where(inArray(cards.careerId, ids))).filter(
      (c) => c.ownerId !== null,
    ).length;

  it('구글 로그인한 구단주만 쓴다', async () => {
    expect((await call('GET', '/v1/exchanges/me')).status).toBe(401);
    const anon = await issueCookie(ctx);
    expect((await call('GET', '/v1/exchanges/me', { cookie: anon.cookie })).status).toBe(403);
  });

  it('조건에 맞는 카드를 내면 카드가 사라지고 보상을 받는다 · 같은 요청은 한 번만 · 횟수 상한', async () => {
    const owner = await issueGoogleCookie(ctx);
    const def = easy();
    const me0 = MeRes.parse(
      await (await call('GET', '/v1/exchanges/me', { cookie: owner.cookie })).json(),
    ).data;
    expect(me0.claims).toEqual({});

    const ids = await addCards(owner.profileId, def);
    const res = await claim(owner.cookie, def.id, ids, 'exchange-same-key');
    expect(res.status).toBe(200);
    const body = ClaimRes.parse(await res.json()).data;
    expect(body.claimed).toBe(def.rule.count);
    expect(body.rewards).toEqual(def.reward);

    const rows = await ctx.db.select().from(cards).where(inArray(cards.careerId, ids));
    expect(rows.every((c) => c.ownerId === null && c.consumedIn && c.releasedAt === null)).toBe(
      true,
    );
    // 기록(careers)은 그대로 남는다.
    expect((await ctx.db.select().from(careers).where(inArray(careers.id, ids))).length).toBe(
      ids.length,
    );
    const items = async () =>
      (await ctx.db.select().from(ownerItems).where(eq(ownerItems.profileId, owner.profileId)))
        .map((r) => ({ item: r.item, qty: r.qty }))
        .sort((a, b) => a.item.localeCompare(b.item));
    expect(await items()).toEqual(def.reward.map((w) => ({ item: w.item, qty: w.qty })));
    const [progress] = await ctx.db
      .select()
      .from(ownerTitleProgress)
      .where(eq(ownerTitleProgress.profileId, owner.profileId));
    expect(progress?.exchanges).toBe(1);

    // 같은 멱등 키로 다시 보내면 첫 응답 그대로 · 보상은 한 번.
    const again = await claim(owner.cookie, def.id, ids, 'exchange-same-key');
    expect(again.status).toBe(200);
    expect(await items()).toEqual(def.reward.map((w) => ({ item: w.item, qty: w.qty })));

    const me1 = MeRes.parse(
      await (await call('GET', '/v1/exchanges/me', { cookie: owner.cookie })).json(),
    ).data;
    expect(me1.claims).toEqual({ [def.id]: 1 });

    for (let i = 1; i < def.maxClaims; i++) {
      const more = await addCards(owner.profileId, def);
      expect((await claim(owner.cookie, def.id, more)).status).toBe(200);
    }
    const over = await addCards(owner.profileId, def);
    const limit = await claim(owner.cookie, def.id, over);
    expect(limit.status).toBe(409);
    expect(await reason(limit)).toBe('EXCHANGE_LIMIT');
    expect(await owned(over)).toBe(over.length);
  });

  it('낼 수 없는 카드 · 조건이 안 맞는 묶음 · 닫힌 과제는 거절하고 아무것도 바꾸지 않는다', async () => {
    const owner = await issueGoogleCookie(ctx);
    const other = await issueGoogleCookie(ctx);
    const def = easy();

    expect(
      (await claim(owner.cookie, '2020-01-06-easy', await addCards(owner.profileId, def))).status,
    ).toBe(404);

    // 장수가 모자라면 조건 불충족.
    const few = await addCards(owner.profileId, def, def.rule.count - 1);
    const short = await claim(owner.cookie, def.id, few);
    expect(short.status).toBe(409);
    expect(await reason(short)).toBe('EXCHANGE_UNMET');

    // 남의 카드가 섞이면 거절.
    const mine = await addCards(owner.profileId, def, def.rule.count - 1);
    const theirs = await addCards(other.profileId, def, 1);
    const mixed = await claim(owner.cookie, def.id, [...mine, ...theirs]);
    expect(await reason(mixed)).toBe('EXCHANGE_CARDS_GONE');

    // 잠긴 카드는 batch 안에서 빠져 장수 확인(CHECK)으로 전체가 되돌아간다.
    const locked = await addCards(owner.profileId, def);
    await ctx.db.update(cards).set({ locked: true }).where(eq(cards.careerId, locked[0]!));
    const res = await claim(owner.cookie, def.id, locked);
    expect(res.status).toBe(409);
    expect(await reason(res)).toBe('EXCHANGE_CARDS_GONE');
    expect(await owned(locked)).toBe(locked.length);

    // 판매 중인 카드도 같다.
    const listed = await addCards(owner.profileId, def);
    await ctx.env.DB.prepare(
      `INSERT INTO market_listings (id, career_id, seller_id, season, price, status, created_at)
       VALUES ('lst_x', ?, ?, 1, 1000000, 'open', ?)`,
    )
      .bind(listed[0], owner.profileId, NOW)
      .run();
    expect(await reason(await claim(owner.cookie, def.id, listed))).toBe('EXCHANGE_CARDS_GONE');
    expect(await owned(listed)).toBe(listed.length);

    expect(
      (
        await ctx.db
          .select()
          .from(cardExchangeClaims)
          .where(eq(cardExchangeClaims.profileId, owner.profileId))
      ).length,
    ).toBe(0);
    expect(
      (await ctx.db.select().from(ownerItems).where(eq(ownerItems.profileId, owner.profileId)))
        .length,
    ).toBe(0);
  });

  it('지금 시즌 선발에 든 선수는 팀에서 뺀 뒤 낸다', async () => {
    const owner = await issueGoogleCookie(ctx);
    const def = easy();
    const ids = await addCards(owner.profileId, def);
    const put = await call('PUT', '/v1/owner-team', {
      cookie: owner.cookie,
      body: {
        name: '우리 FC',
        manager: '김감독',
        formation: '4-3-3',
        slots: [ids[0]!, ...Array<null>(10).fill(null)],
      },
    });
    expect(put.status).toBe(200);
    const res = await claim(owner.cookie, def.id, ids);
    expect(res.status).toBe(409);
    expect(await reason(res)).toBe('IN_LINEUP');
    expect(await owned(ids)).toBe(ids.length);
  });
});
