import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Env } from './env.ts';
import {
  ascToken,
  reviewInteraction,
  reviewTools,
  scanReviews,
  storeApi,
  type ReviewDraft,
  type StoreApi,
  type StoreReview,
} from './reviews.ts';
import type { Task } from './thread.ts';

afterEach(() => vi.unstubAllGlobals());

const pem = (der: ArrayBuffer | JsonWebKey, label: string) =>
  `-----BEGIN ${label}-----\n${btoa(String.fromCharCode(...new Uint8Array(der as ArrayBuffer)))}\n-----END ${label}-----`;

const review = (o: Partial<StoreReview> = {}): StoreReview => ({
  store: 'ios',
  id: 'r1',
  rating: 1,
  title: '계속 튕김',
  body: '시즌 넘어갈 때 꺼져요',
  where: 'KOR',
  version: '',
  at: Date.parse('2026-10-16T00:00:00Z'),
  ...o,
});

/** 가짜 스토어: 리뷰 목록 · 지금 상태 · 단 답글을 기억한다. */
const fakeApi = (list: StoreReview[], current = list[0]) => {
  const replies: string[] = [];
  const api: StoreApi = {
    list: async (store) => list.filter((r) => r.store === store),
    current: async () => current,
    reply: async (store, id, body) => void replies.push(`${store}:${id}:${body}`),
  };
  return { api, replies };
};

describe('ascToken', () => {
  it('ES256으로 서명하고 공개 키로 검증된다', async () => {
    const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
      'sign',
      'verify',
    ])) as CryptoKeyPair;
    const env = {
      ASC_KEY_ID: 'K1',
      ASC_ISSUER_ID: 'ISS',
      ASC_PRIVATE_KEY: pem(await crypto.subtle.exportKey('pkcs8', pair.privateKey), 'PRIVATE KEY'),
    } as Env;
    const t = await ascToken(env, 1_700_000_000_000);
    const [h, b, s] = t.split('.');
    const dec = (x: string) => JSON.parse(atob(x.replace(/-/g, '+').replace(/_/g, '/')));
    expect(dec(h!)).toEqual({ alg: 'ES256', kid: 'K1', typ: 'JWT' });
    expect(dec(b!)).toEqual({
      iss: 'ISS',
      iat: 1_700_000_000,
      exp: 1_700_000_600,
      aud: 'appstoreconnect-v1',
    });
    const sig = Uint8Array.from(atob(s!.replace(/-/g, '+').replace(/_/g, '/')), (c) =>
      c.charCodeAt(0),
    );
    expect(sig.length).toBe(64);
    expect(
      await crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        pair.publicKey,
        sig,
        new TextEncoder().encode(`${h}.${b}`),
      ),
    ).toBe(true);
  });
});

describe('storeApi', () => {
  it('Google Play 리뷰를 제목 · 본문 · 우리 답글로 나눠 읽는다', async () => {
    const pair = (await crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['sign'],
    )) as CryptoKeyPair;
    const env = {
      PLAY_PACKAGE: 'com.offsidelab.app',
      PLAY_SA_EMAIL: 'sa@example.iam.gserviceaccount.com',
      PLAY_SA_KEY: pem(await crypto.subtle.exportKey('pkcs8', pair.privateKey), 'PRIVATE KEY'),
    } as Env;
    const urls: string[] = [];
    const fetcher = (async (u: string) => {
      urls.push(u);
      if (u.includes('oauth2')) return Response.json({ access_token: 'T', expires_in: 3600 });
      return Response.json({
        reviews: [
          {
            reviewId: 'g1',
            comments: [
              {
                userComment: {
                  text: '좋아요\t재밌게 하고 있어요',
                  starRating: 5,
                  reviewerLanguage: 'ko',
                  appVersionName: '1.1.2',
                  lastModified: { seconds: '1760000000' },
                },
              },
              { developerComment: { text: '고마워요', lastModified: { seconds: '1760000100' } } },
            ],
          },
        ],
      });
    }) as unknown as typeof fetch;
    const list = await storeApi(env, fetcher).list('android', 10);
    expect(urls[1]).toBe(
      'https://androidpublisher.googleapis.com/androidpublisher/v3/applications/com.offsidelab.app/reviews?maxResults=10',
    );
    expect(list).toEqual([
      {
        store: 'android',
        id: 'g1',
        rating: 5,
        title: '좋아요',
        body: '재밌게 하고 있어요',
        where: 'ko',
        version: '1.1.2',
        at: 1_760_000_000_000,
        reply: { body: '고마워요', at: 1_760_000_100_000 },
      },
    ]);
  });

  it('연결되지 않은 스토어는 이유를 던진다', async () => {
    await expect(storeApi({} as Env).list('ios', 5)).rejects.toThrow(/연결되지 않았어요/);
  });
});

const ready = {
  ASC_KEY_ID: 'K',
  ASC_ISSUER_ID: 'I',
  ASC_PRIVATE_KEY: 'P',
  ASC_APP_ID: '1',
  OPERATOR_USER_ID: 'UOP',
  APPROVAL_CHANNEL: 'CAPP',
  DESK_CHANNEL: 'CDESK',
  SLACK_PLAN_BOT_TOKEN: 'x',
};

describe('review_draft', () => {
  const setup = (current: StoreReview | undefined) => {
    const slack: string[] = [];
    vi.stubGlobal('fetch', async (u: string) => {
      slack.push(u.split('/').pop()!);
      return Response.json({ ok: true, ts: '9.9' });
    });
    const drafts: ReviewDraft[] = [];
    const book = {
      setReviewDraft: async (d: ReviewDraft) => void drafts.push(d),
      pendingAdd: async () => {},
    };
    const env = {
      ...ready,
      LEDGER: { idFromName: () => 'id', get: () => book },
    } as unknown as Env;
    const { api } = fakeApi([review()], current);
    const tool = reviewTools(env, { kind: 'reviews' } as Task, api).find(
      (t) => t.name === 'review_draft',
    )!;
    return { tool, drafts, slack };
  };

  it('Google Play 350자를 넘기거나 이미 답글이 있으면 만들지 않는다', async () => {
    const s = setup(review({ store: 'android' }));
    await expect(
      s.tool.run({ store: 'android', review_id: 'r1', body: 'x'.repeat(351) }),
    ).rejects.toThrow(/350자/);
    const t = setup(review({ reply: { body: '이미', at: 1 } })).tool;
    await expect(t.run({ store: 'ios', review_id: 'r1', body: '고마워요' })).rejects.toThrow(
      /이미 우리 답글/,
    );
  });

  it('초안을 저장하고 승인 카드를 올린다', async () => {
    const s = setup(review());
    expect(
      await s.tool.run({ store: 'ios', review_id: 'r1', body: '불편을 드려 죄송해요' }),
    ).toContain('승인 카드');
    expect(s.drafts).toMatchObject([
      { store: 'ios', reviewId: 'r1', rating: 1, body: '불편을 드려 죄송해요' },
    ]);
    expect(s.slack).toEqual(['chat.postMessage']);
  });

  it('반응 살피기 · 넘겨받은 일에는 리뷰 도구를 주지 않는다', () => {
    const env = ready as unknown as Env;
    expect(reviewTools(env, { kind: 'triage' } as Task)).toEqual([]);
    expect(reviewTools(env, { kind: 'handoff' } as Task)).toEqual([]);
    expect(reviewTools({} as Env, { kind: 'mention' } as Task)).toEqual([]);
  });
});

describe('reviewInteraction', () => {
  const draft: ReviewDraft = {
    id: 'd1',
    store: 'ios',
    reviewId: 'r1',
    rating: 1,
    excerpt: '계속 튕김',
    body: '불편을 드려 죄송해요',
    at: 1,
  };
  const setup = (current: StoreReview | undefined, d: ReviewDraft = draft) => {
    const slack: string[] = [];
    vi.stubGlobal('fetch', async (u: string) => {
      slack.push(u.split('/').pop()!);
      return Response.json({ ok: true });
    });
    const saved: ReviewDraft[] = [];
    const records: unknown[] = [];
    const book = {
      reviewDraft: async () => d,
      setReviewDraft: async (x: ReviewDraft) => void saved.push(x),
      recordReviewApproval: async (a: unknown) => void records.push(a),
    };
    const env = { ...ready, LEDGER: { idFromName: () => 'id', get: () => book } } as unknown as Env;
    const fake = fakeApi([], current);
    return { env, ...fake, slack, saved, records };
  };
  const press = (user: string, action = 'review_send') => ({
    type: 'block_actions',
    user: { id: user },
    channel: { id: 'CAPP' },
    message: { ts: '1.0', blocks: [] },
    actions: [{ action_id: action, value: JSON.stringify({ draft: 'd1' }) }],
  });

  it('운영자가 아니면 달지 않는다', async () => {
    const s = setup(review());
    expect(await reviewInteraction(s.env, press('UX'), s.api)).toBe('forbidden');
    expect(s.replies).toEqual([]);
  });

  it('그 사이 답글이 달렸으면 덮어쓰지 않는다', async () => {
    const s = setup(review({ reply: { body: '콘솔에서 단 답', at: 2 } }));
    expect(await reviewInteraction(s.env, press('UOP'), s.api)).toBe('blocked');
    expect(s.replies).toEqual([]);
  });

  it('운영자 승인이면 답글을 달고 다시 누르면 아무것도 하지 않는다', async () => {
    const s = setup(review());
    expect(await reviewInteraction(s.env, press('UOP'), s.api)).toBe('sent');
    expect(s.replies).toEqual(['ios:r1:불편을 드려 죄송해요']);
    expect(s.saved.at(-1)?.sent).toBe('sent');
    expect(s.records).toMatchObject([{ draft: 'd1', action: 'send', user: 'UOP', result: 'sent' }]);
    const again = setup(review(), { ...draft, sent: 'sent' });
    expect(await reviewInteraction(again.env, press('UOP'), again.api)).toBe('done');
    expect(again.replies).toEqual([]);
  });

  it('버리기는 답글 없이 기록만 남긴다', async () => {
    const s = setup(review());
    expect(await reviewInteraction(s.env, press('UOP', 'review_discard'), s.api)).toBe('discarded');
    expect(s.replies).toEqual([]);
  });
});

describe('scanReviews', () => {
  const setup = (cursor: number | undefined, list: StoreReview[]) => {
    const state = { cursor, tasks: [] as Task[] };
    const book = {
      reviewsCursor: async () => state.cursor,
      setReviewsCursor: async (at: number) => void (state.cursor = at),
    };
    const env = {
      ...ready,
      LEDGER: { idFromName: () => 'id', get: () => book },
      THREAD: {
        idFromName: (k: string) => k,
        get: () => ({ enqueue: async (t: Task) => void state.tasks.push(t) }),
      },
    } as unknown as Env;
    return { env, state, api: fakeApi(list).api };
  };
  const t0 = Date.parse('2026-10-17T00:00:00Z');

  it('커서 뒤 답글 없는 리뷰만 넘기고 커서를 가장 늦은 리뷰로 옮긴다', async () => {
    const s = setup(t0, [
      review({ id: 'old', at: t0 - 1000 }),
      review({ id: 'new', at: t0 + 1000 }),
      review({ id: 'replied', at: t0 + 2000, reply: { body: 'x', at: t0 + 3000 } }),
    ]);
    expect(await scanReviews(s.env, t0 + 5000, s.api)).toMatchObject({ reviews: 1, ready: true });
    expect(s.state.cursor).toBe(t0 + 2000);
    expect(s.state.tasks).toHaveLength(1);
    expect(s.state.tasks[0]).toMatchObject({ kind: 'reviews', role: 'plan', threadTs: '' });
    expect(s.state.tasks[0]!.text).toContain('"review_id":"new"');
    expect(s.state.tasks[0]!.text).not.toContain('"review_id":"old"');
  });

  it('처음이면 하루만 거슬러 보고, 새 리뷰가 없으면 일을 맡기지 않는다', async () => {
    const s = setup(undefined, [review({ at: t0 - 2 * 24 * 3600_000 })]);
    expect(await scanReviews(s.env, t0, s.api)).toMatchObject({ reviews: 0 });
    expect(s.state.tasks).toEqual([]);
  });

  it('스토어가 연결되지 않았으면 아무것도 하지 않는다', async () => {
    expect(await scanReviews({} as Env)).toMatchObject({ ready: false });
  });
});
