import { ErrorEnvelopeSchema, successEnvelope, ServiceSeasonCurrentSchema } from '@offside/contracts';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { upsertServiceSeason } from '../db/repos/serviceSeasons.js';
import { createTestD1 } from '../test/d1.js';

describe('GET /v1/service-seasons/current (API-SVC-001)', () => {
  it('포인터가 가리키는 시즌을 돌려준다(프로필 세션 불필요, 공개)', async () => {
    const ctx = await createTestD1();
    try {
      await upsertServiceSeason(ctx.db, {
        id: 'svc_kickoff',
        name: 'Kickoff',
        status: 'ACTIVE',
        startsAt: '2026-01-01T00:00:00Z',
        endsAt: '2026-12-31T23:59:59Z',
        rulesetVersion: '1.0.0',
        contentPackVersion: '0.1.0',
        challengeSetId: 'cs_kickoff',
      });
      const app = createApp();
      const env = { ...ctx.env, ACTIVE_SERVICE_SEASON_ID: 'svc_kickoff' };

      const res = await app.request('/v1/service-seasons/current', {}, env);
      expect(res.status).toBe(200);
      expect(res.headers.get('Cache-Control')).toBe('public, max-age=60');
      const body = successEnvelope(ServiceSeasonCurrentSchema).parse(await res.json());
      expect(body.data).toEqual({
        id: 'svc_kickoff',
        name: 'Kickoff',
        status: 'ACTIVE',
        isTest: false,
        startsAt: '2026-01-01T00:00:00Z',
        endsAt: '2026-12-31T23:59:59Z',
        rulesetVersion: '1.0.0',
        contentPackVersion: '0.1.0',
        notice: null,
      });
    } finally {
      await ctx.dispose();
    }
  });

  it('isTest 시즌이면 notice가 LINE_TEST다', async () => {
    const ctx = await createTestD1();
    try {
      await upsertServiceSeason(ctx.db, {
        id: 'svc_line_test',
        name: 'LINE TEST',
        status: 'PRESEASON',
        startsAt: '2026-09-08T00:00:00Z',
        endsAt: '2026-10-31T23:59:59Z',
        rulesetVersion: '1.0.0',
        contentPackVersion: '0.1.0',
        challengeSetId: 'cs_line_test',
        isTest: true,
      });
      const app = createApp();
      const env = { ...ctx.env, ACTIVE_SERVICE_SEASON_ID: 'svc_line_test' };

      const res = await app.request('/v1/service-seasons/current', {}, env);
      expect(res.status).toBe(200);
      const body = successEnvelope(ServiceSeasonCurrentSchema).parse(await res.json());
      expect(body.data.isTest).toBe(true);
      expect(body.data.notice).toBe('LINE_TEST');
    } finally {
      await ctx.dispose();
    }
  });

  it('포인터 환경변수가 비어 있으면 503 SERVICE_SEASON_UNAVAILABLE', async () => {
    const ctx = await createTestD1();
    try {
      const app = createApp();
      const env = { ...ctx.env, ACTIVE_SERVICE_SEASON_ID: undefined };

      const res = await app.request('/v1/service-seasons/current', {}, env);
      expect(res.status).toBe(503);
      expect(ErrorEnvelopeSchema.parse(await res.json()).error.code).toBe('SERVICE_SEASON_UNAVAILABLE');
    } finally {
      await ctx.dispose();
    }
  });

  it('포인터가 가리키는 행이 없으면 503 SERVICE_SEASON_UNAVAILABLE', async () => {
    const ctx = await createTestD1();
    try {
      const app = createApp();
      const env = { ...ctx.env, ACTIVE_SERVICE_SEASON_ID: 'svc_missing' };

      const res = await app.request('/v1/service-seasons/current', {}, env);
      expect(res.status).toBe(503);
      expect(ErrorEnvelopeSchema.parse(await res.json()).error.code).toBe('SERVICE_SEASON_UNAVAILABLE');
    } finally {
      await ctx.dispose();
    }
  });
});
