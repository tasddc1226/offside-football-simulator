import { CupMeResponseSchema, ErrorEnvelopeSchema, successEnvelope } from '@offside/contracts';
import { CUPS } from '@offside/contracts/cup';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cards, careers, cupEntries, profiles } from '../db/schema.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { callJson, issueGoogleCookie } from '../test/http.js';
import { checkCupListing } from './cup.js';

const MeRes = successEnvelope(CupMeResponseSchema);
const CUP = CUPS[0]!;
const OPEN = '2026-10-10T03:00:00.000Z';
let seq = 0;

describe('/v1/cups (T-11-145 오프사이드 컵 신청)', () => {
  let ctx: TestD1;
  beforeEach(async () => {
    ctx = await createTestD1();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(OPEN));
  });
  afterEach(async () => {
    vi.useRealTimers();
    await ctx.dispose();
  });

  const call = (method: string, path: string, opts?: Parameters<typeof callJson>[3]) =>
    callJson(ctx.env, method, path, opts);
  const idem = () => ({ 'Idempotency-Key': `cup-entry-${++seq}-key` });
  const enter = (cookie: string) =>
    call('POST', `/v1/cups/${CUP.id}/entries`, { cookie, headers: idem() });
  const me = async (cookie: string) =>
    MeRes.parse(await (await call('GET', `/v1/cups/${CUP.id}/me`, { cookie })).json()).data;
  const reason = async (res: Response) =>
    ErrorEnvelopeSchema.parse(await res.json()).error.details?.reason;

  /** 시즌 1 카드 n장으로 선발을 채운 구단주. */
  async function owner(n: number) {
    const who = await issueGoogleCookie(ctx, { nickname: `컵${++seq}` });
    const ids: string[] = [];
    for (let i = 0; i < n; i++) {
      const id = crypto.randomUUID();
      const at = '2026-10-06T00:00:00.000Z';
      await ctx.db.insert(careers).values({
        id,
        profileId: who.profileId,
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
        retireAge: 34,
        peak: 80,
        legendScore: 300,
        shirtNumber: 9,
        serviceSeason: 1,
      });
      await ctx.db.insert(cards).values({
        careerId: id,
        ownerId: who.profileId,
        serviceSeason: 1,
        pos: 'FW',
        number: 9,
        peak: 80,
        legendScore: 300,
        retireValue: 0,
        createdAt: at,
        updatedAt: at,
      });
      ids.push(id);
    }
    const slots = [...ids, ...Array(11 - n).fill(null)];
    const put = (s: (string | null)[]) =>
      call('PUT', '/v1/owner-team', {
        cookie: who.cookie,
        body: { name: `컵팀${seq}`, manager: '김감독', formation: '4-3-3', slots: s },
      });
    expect((await put(slots)).status).toBe(200);
    return { ...who, ids, put };
  }

  it('선발 8명 이상이면 신청·취소·다시 신청할 수 있다', async () => {
    const a = await owner(8);
    expect((await me(a.cookie)).eligibility).toMatchObject({ ok: true, filled: 8 });
    expect((await enter(a.cookie)).status).toBe(201);
    // 두 번 눌러도 한 번만 들어간다.
    expect((await enter(a.cookie)).status).toBe(204);
    expect((await me(a.cookie)).entry).toMatchObject({ status: 'active' });
    const del = await call('DELETE', `/v1/cups/${CUP.id}/entries/me`, { cookie: a.cookie });
    expect(del.status).toBe(204);
    expect((await me(a.cookie)).entry).toMatchObject({ status: 'withdrawn' });
    expect((await enter(a.cookie)).status).toBe(201);
    expect(await ctx.db.select().from(cupEntries)).toHaveLength(1);
  });

  it('선발 7명이면 신청할 수 없다', async () => {
    const a = await owner(7);
    expect((await me(a.cookie)).eligibility).toMatchObject({ ok: false, reason: 'not-enough' });
    const res = await enter(a.cookie);
    expect(res.status).toBe(409);
    expect(await reason(res)).toBe('CUP_NOT_ENOUGH');
  });

  it('접수 전·후에는 신청할 수 없다', async () => {
    const a = await owner(8);
    vi.setSystemTime(new Date(Date.parse(CUP.opensAt) - 1000));
    expect(await reason(await enter(a.cookie))).toBe('CUP_CLOSED');
    vi.setSystemTime(new Date(CUP.closesAt));
    expect(await reason(await enter(a.cookie))).toBe('CUP_CLOSED');
  });

  it('정원이 차면 신청할 수 없다', async () => {
    for (let i = 0; i < CUP.capacity; i++) {
      const profileId = `prf_full_${i}`;
      await ctx.db
        .insert(profiles)
        .values({ id: profileId, settingsJson: '{}', createdAt: OPEN, lastSeenAt: OPEN });
      await ctx.db.insert(cupEntries).values({
        cupId: CUP.id,
        teamId: `tem_full_${i}`,
        profileId,
        name: `팀${i}`,
        manager: '감독',
        ovr: 60,
        createdAt: OPEN,
        updatedAt: OPEN,
      });
    }
    const a = await owner(8);
    expect((await me(a.cookie)).eligibility).toMatchObject({ ok: false, reason: 'full' });
    expect(await reason(await enter(a.cookie))).toBe('CUP_FULL');
  });

  it('참가 중에는 선발을 8명 밑으로 줄이거나 선발 선수를 내놓을 수 없다', async () => {
    const a = await owner(8);
    expect((await enter(a.cookie)).status).toBe(201);
    const fewer = await a.put([...a.ids.slice(0, 7), ...Array(4).fill(null)]);
    expect(fewer.status).toBe(409);
    expect(await reason(fewer)).toBe('CUP_MIN_FILLED');
    await expect(checkCupListing(ctx.db, a.profileId, 1, a.ids[0]!)).rejects.toMatchObject({
      details: { reason: 'CUP_CARD_LOCKED' },
    });
    // 취소하면 풀린다.
    await call('DELETE', `/v1/cups/${CUP.id}/entries/me`, { cookie: a.cookie });
    await expect(checkCupListing(ctx.db, a.profileId, 1, a.ids[0]!)).resolves.toBeUndefined();
    expect((await a.put([...a.ids.slice(0, 7), ...Array(4).fill(null)])).status).toBe(200);
  });
});
