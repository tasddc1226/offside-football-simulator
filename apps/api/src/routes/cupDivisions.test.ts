import {
  CupHomeResponseSchema,
  CupMeResponseSchema,
  CupResponseSchema,
  ErrorEnvelopeSchema,
  successEnvelope,
} from '@offside/contracts';
import { CUP_DIVISIONS, planCup } from '@offside/contracts/cup';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cards, careers, cupEntries, cups } from '../db/schema.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { callJson, issueGoogleCookie } from '../test/http.js';

// T-11-410 OVR 구간별 대회 신청 · 조회.

const MeRes = successEnvelope(CupMeResponseSchema);
const CupRes = successEnvelope(CupResponseSchema);
const HomeRes = successEnvelope(CupHomeResponseSchema);
const OPEN = '2026-10-10T03:00:00.000Z';
const BASE = planCup({ id: '', season: 1, edition: 3, opensOn: '2026-10-10' });
let seq = 0;

describe('/v1/cups 구간 대회 (T-11-410)', () => {
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
  const idem = () => ({ 'Idempotency-Key': `cup-div-${++seq}-key` });
  const reason = async (res: Response) =>
    (ErrorEnvelopeSchema.parse(await res.json()).error.details as { reason?: string } | undefined)
      ?.reason;
  const me = async (cookie: string, id = 'current') =>
    MeRes.parse(await (await call('GET', `/v1/cups/${id}/me`, { cookie })).json()).data;

  async function edition(caps: [number | null, number | null]) {
    for (const [i, division] of CUP_DIVISIONS.entries())
      await ctx.db.insert(cups).values({
        id: `s1-3-${division}`,
        season: 1,
        edition: 3,
        opensAt: BASE.opensAt,
        closesAt: BASE.closesAt,
        drawAt: BASE.drawAt,
        roundsJson: JSON.stringify(BASE.rounds),
        capacity: BASE.capacity,
        minFilled: BASE.minFilled,
        createdAt: BASE.opensAt,
        division,
        ovrMax: caps[i] ?? null,
      });
  }

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

  it('current는 마스터를 보이고 구간 목록을 싣는다, 신청은 내 OVR로 들어갈 가장 낮은 구간으로', async () => {
    const a = await owner(8);
    const ovr = (await me(a.cookie, 's1-1')).ovr;
    expect(typeof ovr).toBe('number');
    // 주니어는 내 OVR보다 1 낮게, 시니어는 내 OVR에 딱 맞게.
    await edition([ovr! - 1, ovr!]);
    const view = CupRes.parse(await (await call('GET', '/v1/cups/current')).json()).data;
    expect(view.cup).toMatchObject({ id: 's1-3-master', division: 'master', ovrMax: null });
    expect(view.divisions!.map((d) => [d.id, d.ovrMax, d.entries])).toEqual([
      ['s1-3-junior', ovr! - 1, 0],
      ['s1-3-senior', ovr!, 0],
      ['s1-3-master', null, 0],
    ]);
    // 신청 전 current/me는 들어갈 수 있는 가장 낮은 구간(시니어)을 본다.
    expect(await me(a.cookie)).toMatchObject({
      cupId: 's1-3-senior',
      ovr,
      eligibility: { ok: true },
    });
    // 주니어에 직접 신청하면 상한을 넘는다.
    const over = await call('POST', '/v1/cups/s1-3-junior/entries', {
      cookie: a.cookie,
      headers: idem(),
    });
    expect([over.status, await reason(over)]).toEqual([409, 'CUP_OVER_CAP']);
    // 구간을 모르는 옛 앱처럼 current로 신청하면 시니어에 들어간다.
    expect(
      (await call('POST', '/v1/cups/current/entries', { cookie: a.cookie, headers: idem() }))
        .status,
    ).toBe(204);
    const rows = await ctx.db
      .select()
      .from(cupEntries)
      .where(eq(cupEntries.profileId, a.profileId));
    expect(rows.map((r) => r.cupId)).toEqual(['s1-3-senior']);
    expect(await me(a.cookie)).toMatchObject({ cupId: 's1-3-senior', entry: { status: 'active' } });
    // 같은 회차 다른 구간(마스터 도전)은 먼저 취소해야 한다.
    expect((await me(a.cookie, 's1-3-master')).eligibility).toMatchObject({
      ok: false,
      reason: 'entered-other',
    });
    const other = await call('POST', '/v1/cups/s1-3-master/entries', {
      cookie: a.cookie,
      headers: idem(),
    });
    expect([other.status, await reason(other)]).toEqual([409, 'CUP_ENTERED_OTHER']);
    expect((await call('DELETE', '/v1/cups/current/entries/me', { cookie: a.cookie })).status).toBe(
      204,
    );
    expect(
      (await call('POST', '/v1/cups/s1-3-master/entries', { cookie: a.cookie, headers: idem() }))
        .status,
    ).toBe(204);
    // 홈은 구간 신청 수를 합한다.
    const home = HomeRes.parse(await (await call('GET', '/v1/cups/home')).json()).data;
    expect(home.entries).toBe(1);
    expect(home.divisions!.map((d) => d.entries)).toEqual([0, 0, 1]);
  });

  it('접수가 열렸어도 아랫 구간 상한이 비어 있으면 아직 신청할 수 없다', async () => {
    const a = await owner(8);
    await edition([null, null]);
    expect((await me(a.cookie, 's1-3-junior')).eligibility).toMatchObject({
      ok: false,
      reason: 'closed',
    });
    // 상한이 없는 동안 current는 마스터로 간다.
    expect((await me(a.cookie)).cupId).toBe('s1-3-master');
  });
});
