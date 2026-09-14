import { NoticesResponseSchema, successEnvelope } from '@offside/contracts';
import { describe, expect, it } from 'vitest';
import { notices } from '../db/schema.js';
import { createApp } from '../app.js';
import { createTestD1 } from '../test/d1.js';

type SeedNotice = {
  id: string;
  title: string;
  body: readonly string[];
  publishedAt: string;
  isPublished?: boolean;
};

/** 2026-01-01T00:00:00Z에서 `offsetDays`만큼 뒤로 간 ISO 시각. limit 테스트용 서로 다른 publishedAt. */
function isoDaysAfterEpoch(offsetDays: number): string {
  const base = Date.UTC(2026, 0, 1);
  return new Date(base + offsetDays * 86_400_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

async function seedNotice(db: Awaited<ReturnType<typeof createTestD1>>['db'], input: SeedNotice): Promise<void> {
  await db.insert(notices).values({
    id: input.id,
    title: input.title,
    body: JSON.stringify(input.body),
    publishedAt: input.publishedAt,
    isPublished: (input.isPublished ?? true) ? 1 : 0,
    createdAt: input.publishedAt,
    updatedAt: input.publishedAt,
  });
}

describe('GET /v1/notices (API-NOTICE-001)', () => {
  it('게시된 공지가 없으면 빈 목록을 돌려준다', async () => {
    const ctx = await createTestD1();
    try {
      const res = await createApp().request('/v1/notices', {}, ctx.env);
      expect(res.status).toBe(200);
      expect(res.headers.get('Cache-Control')).toBe('public, max-age=60');
      const body = successEnvelope(NoticesResponseSchema).parse(await res.json());
      expect(body.data.items).toEqual([]);
    } finally {
      await ctx.dispose();
    }
  });

  it('published_at 내림차순으로 정렬하고, 게시되지 않은 공지는 제외한다', async () => {
    const ctx = await createTestD1();
    try {
      await seedNotice(ctx.db, {
        id: 'older',
        title: '오래된 공지',
        body: ['첫 문단'],
        publishedAt: '2026-09-01T00:00:00Z',
      });
      await seedNotice(ctx.db, {
        id: 'newer',
        title: '최신 공지',
        body: ['첫 문단', '둘째 문단'],
        publishedAt: '2026-09-06T09:00:00Z',
      });
      await seedNotice(ctx.db, {
        id: 'draft',
        title: '아직 게시 전',
        body: ['숨김'],
        publishedAt: '2026-09-10T00:00:00Z',
        isPublished: false,
      });

      const res = await createApp().request('/v1/notices', {}, ctx.env);
      expect(res.status).toBe(200);
      const body = successEnvelope(NoticesResponseSchema).parse(await res.json());
      expect(body.data.items.map((item) => item.id)).toEqual(['newer', 'older']);
      expect(body.data.items[0]).toEqual({
        id: 'newer',
        title: '최신 공지',
        body: ['첫 문단', '둘째 문단'],
        publishedAt: '2026-09-06T09:00:00Z',
      });
    } finally {
      await ctx.dispose();
    }
  });

  it('limit 상한(50)을 넘는 값은 50으로 잘린다', async () => {
    const ctx = await createTestD1();
    try {
      for (let i = 0; i < 55; i += 1) {
        await seedNotice(ctx.db, {
          id: `notice-${String(i).padStart(2, '0')}`,
          title: `공지 ${i}`,
          body: ['본문'],
          publishedAt: isoDaysAfterEpoch(i),
        });
      }

      const res = await createApp().request('/v1/notices?limit=999', {}, ctx.env);
      expect(res.status).toBe(200);
      const body = successEnvelope(NoticesResponseSchema).parse(await res.json());
      expect(body.data.items.length).toBe(50);
      // 내림차순이므로 가장 마지막에 넣은(가장 최신) 공지가 먼저 와야 한다.
      expect(body.data.items[0]?.id).toBe('notice-54');
    } finally {
      await ctx.dispose();
    }
  });

  it('빈/공백 문단은 걸러내고, 문단이 모두 비면 그 공지를 응답에서 제외한다', async () => {
    const ctx = await createTestD1();
    try {
      await seedNotice(ctx.db, {
        id: 'mixed',
        title: '일부 문단이 비어 있는 공지',
        body: ['', '   ', '실제 문단'],
        publishedAt: '2026-09-10T00:00:00Z',
      });
      await seedNotice(ctx.db, {
        id: 'empty-only',
        title: '문단이 모두 비어 있는 공지',
        body: ['', '   '],
        publishedAt: '2026-09-05T00:00:00Z',
      });

      const res = await createApp().request('/v1/notices', {}, ctx.env);
      expect(res.status).toBe(200);
      const body = successEnvelope(NoticesResponseSchema).parse(await res.json());
      expect(body.data.items.map((item) => item.id)).toEqual(['mixed']);
      expect(body.data.items[0]?.body).toEqual(['실제 문단']);
    } finally {
      await ctx.dispose();
    }
  });

  it('limit이 정수가 아니면(소수·NaN·0 이하) 기본값 10건까지만 돌려준다', async () => {
    const ctx = await createTestD1();
    try {
      for (let i = 0; i < 15; i += 1) {
        await seedNotice(ctx.db, {
          id: `notice-${String(i).padStart(2, '0')}`,
          title: `공지 ${i}`,
          body: ['본문'],
          publishedAt: isoDaysAfterEpoch(i),
        });
      }

      for (const limit of ['3.5', 'not-a-number', '0', '-5']) {
        const res = await createApp().request(`/v1/notices?limit=${limit}`, {}, ctx.env);
        expect(res.status).toBe(200);
        const body = successEnvelope(NoticesResponseSchema).parse(await res.json());
        expect(body.data.items.length).toBe(10);
      }
    } finally {
      await ctx.dispose();
    }
  });

  it('limit을 생략하면 기본값 10건까지만 돌려준다', async () => {
    const ctx = await createTestD1();
    try {
      for (let i = 0; i < 15; i += 1) {
        await seedNotice(ctx.db, {
          id: `notice-${String(i).padStart(2, '0')}`,
          title: `공지 ${i}`,
          body: ['본문'],
          publishedAt: isoDaysAfterEpoch(i),
        });
      }

      const res = await createApp().request('/v1/notices', {}, ctx.env);
      expect(res.status).toBe(200);
      const body = successEnvelope(NoticesResponseSchema).parse(await res.json());
      expect(body.data.items.length).toBe(10);
    } finally {
      await ctx.dispose();
    }
  });
});
