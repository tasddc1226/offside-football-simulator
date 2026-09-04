import { ErrorEnvelopeSchema } from '@offside/contracts';
import { and, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { analyticsEvents } from '../db/schema.js';
import { createTestD1, type TestD1 } from '../test/d1.js';

const ALLOWED_ORIGIN = 'http://localhost:5173';

function postInit(body: unknown, headers: Record<string, string> = {}): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ALLOWED_ORIGIN, ...headers },
    body: JSON.stringify(body),
  };
}

function makeEvent(name: string, props: Record<string, unknown>, clientTs = 1_757_000_000_000) {
  return { name, props, clientTs };
}

describe('POST /v1/analytics/events (API-ANA-001)', () => {
  let ctx: TestD1;

  beforeEach(async () => {
    ctx = await createTestD1();
  });

  afterEach(async () => {
    await ctx.dispose();
  });

  it('화이트리스트 이벤트는 저장되고 202를 돌려준다(익명 허용)', async () => {
    const app = createApp();
    const res = await app.request(
      '/v1/analytics/events',
      postInit({
        clientId: 'clt_e2e_1',
        events: [makeEvent('screen_viewed', { screenId: 'SCR-001', careerPhase: 'NONE' })],
      }),
      ctx.env,
    );
    expect(res.status).toBe(202);

    const rows = await ctx.db.select().from(analyticsEvents).where(eq(analyticsEvents.clientId, 'clt_e2e_1'));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe('screen_viewed');
    expect(rows[0]?.profileId).toBeNull();
    expect(JSON.parse(rows[0]!.propsJson)).toEqual({ screenId: 'SCR-001', careerPhase: 'NONE' });
  });

  it('화이트리스트 밖 이름과 props 타입이 안 맞는 이벤트는 건별로 버리고 나머지만 저장한다(요청 전체는 202)', async () => {
    const app = createApp();
    const res = await app.request(
      '/v1/analytics/events',
      postInit({
        clientId: 'clt_e2e_2',
        events: [
          makeEvent('not_whitelisted', { anything: 'x' }),
          makeEvent('screen_viewed', { screenId: 'not-a-valid-id', careerPhase: 'NONE' }),
          makeEvent('choice_previewed', { eventId: 'EVT-1', choiceId: 'a' }),
        ],
      }),
      ctx.env,
    );
    expect(res.status).toBe(202);

    const rows = await ctx.db.select().from(analyticsEvents).where(eq(analyticsEvents.clientId, 'clt_e2e_2'));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe('choice_previewed');
  });

  it('스키마에 없는 키(예: 선수 이름 원문)를 담은 이벤트는 strictObject 위반으로 버려진다', async () => {
    const app = createApp();
    const res = await app.request(
      '/v1/analytics/events',
      postInit({
        clientId: 'clt_e2e_pii',
        events: [makeEvent('screen_viewed', { screenId: 'SCR-001', careerPhase: 'NONE', playerName: '김서준' })],
      }),
      ctx.env,
    );
    expect(res.status).toBe(202);
    const rows = await ctx.db.select().from(analyticsEvents).where(eq(analyticsEvents.clientId, 'clt_e2e_pii'));
    expect(rows).toHaveLength(0);
  });

  it('events가 50건을 넘으면 400 VALIDATION_FAILED(요청 전체 거부)', async () => {
    const app = createApp();
    const events = Array.from({ length: 51 }, () => makeEvent('choice_previewed', { eventId: 'EVT-1', choiceId: 'a' }));
    const res = await app.request('/v1/analytics/events', postInit({ clientId: 'clt_e2e_3', events }), ctx.env);
    expect(res.status).toBe(400);
    expect(ErrorEnvelopeSchema.parse(await res.json()).error.code).toBe('VALIDATION_FAILED');
  });

  it('프로필 세션이 있으면 profileId를 함께 저장한다', async () => {
    const app = createApp();
    const profileRes = await app.request('/v1/profile', {}, ctx.env);
    const cookieToken = /offside_session=([^;]+)/.exec(profileRes.headers.get('Set-Cookie') ?? '')?.[1];
    if (!cookieToken) throw new Error('세션 쿠키를 발급받지 못했다');

    const res = await app.request(
      '/v1/analytics/events',
      postInit(
        { clientId: 'clt_e2e_profile', events: [makeEvent('choice_previewed', { eventId: 'EVT-1', choiceId: 'a' })] },
        { Cookie: `offside_session=${cookieToken}` },
      ),
      ctx.env,
    );
    expect(res.status).toBe(202);

    const rows = await ctx.db.select().from(analyticsEvents).where(eq(analyticsEvents.clientId, 'clt_e2e_profile'));
    expect(rows[0]?.profileId).not.toBeNull();
  });

  it('같은 clientId로 분당 60회를 넘으면(61번째) 429 RATE_LIMITED', async () => {
    const app = createApp();
    const clientId = 'clt_e2e_rate';

    for (let i = 1; i <= 60; i++) {
      const res = await app.request(
        '/v1/analytics/events',
        postInit({ clientId, events: [makeEvent('choice_previewed', { eventId: 'EVT-1', choiceId: 'a' })] }),
        ctx.env,
      );
      expect(res.status).toBe(202);
    }

    const res61 = await app.request(
      '/v1/analytics/events',
      postInit({ clientId, events: [makeEvent('choice_previewed', { eventId: 'EVT-1', choiceId: 'a' })] }),
      ctx.env,
    );
    expect(res61.status).toBe(429);
    expect(ErrorEnvelopeSchema.parse(await res61.json()).error.code).toBe('RATE_LIMITED');

    const rows = await ctx.db
      .select()
      .from(analyticsEvents)
      .where(and(eq(analyticsEvents.clientId, clientId), eq(analyticsEvents.name, 'choice_previewed')));
    expect(rows).toHaveLength(60);
  }, 20000);

  it('본문이 JSON이 아니면 400 VALIDATION_FAILED', async () => {
    const app = createApp();
    const res = await app.request(
      '/v1/analytics/events',
      { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: ALLOWED_ORIGIN }, body: 'not json' },
      ctx.env,
    );
    expect(res.status).toBe(400);
  });
});
