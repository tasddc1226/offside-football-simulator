import { describe, expect, it, vi } from 'vitest';
import type { Env } from './env.ts';
import { refreshSocialToken, socialTools, type SocialToken } from './social.ts';

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const NOW = Date.parse('2026-10-18T03:00:00Z');
const noStore = { socialToken: async () => undefined };

describe('SNS 읽기 도구 (T-11-395)', () => {
  it('토큰이 있는 도구만, 마케팅이 쓰는 일에만 준다', () => {
    expect(socialTools({} as Env, 'mention')).toEqual([]);
    const env = {
      META_ADS_ACCESS_TOKEN: 'a',
      META_IG_USER_ID: '178',
      THREADS_ACCESS_TOKEN: 'th',
    } as unknown as Env;
    expect(socialTools(env, 'mention').map((t) => t.name)).toEqual(['instagram', 'threads']);
    expect(socialTools(env, 'triage')).toEqual([]);
    // IG 사용자 ID가 없으면 인스타그램 도구는 없다.
    expect(
      socialTools({ META_GRAPH_TOKEN: 'g' } as unknown as Env, 'mention').map((t) => t.name),
    ).toEqual([]);
  });

  it('인스타그램 계정 요약은 프로필과 기간 합계 인사이트를 읽기만 한다', async () => {
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      expect(init?.method ?? 'GET').toBe('GET');
      expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer g');
      if (url.includes('/insights'))
        return ok({ data: [{ name: 'reach', total_value: { value: 420 } }] });
      return ok({ username: 'offside.lab.kr', followers_count: 14, media_count: 14 });
    });
    const env = { META_GRAPH_TOKEN: 'g', META_IG_USER_ID: '178' } as unknown as Env;
    const [ig] = socialTools(env, 'mention', fetcher as unknown as typeof fetch, () => NOW);
    expect(await ig!.run({ view: 'account', days: 7 })).toBe(
      '@offside.lab.kr 팔로워 14 · 게시물 14\n지난 7일: reach 420',
    );
    const insights = String(fetcher.mock.calls[1]![0]);
    expect(insights).toContain('178/insights');
    expect(insights).toContain('metric_type=total_value');
    expect(insights).toContain(`since=${(NOW - 7 * 86_400_000) / 1000}`);
  });

  it('인스타그램 게시물 · 댓글을 표로 돌려주고 잘못된 ID는 묻지 않는다', async () => {
    const fetcher = vi.fn(async (url: string) =>
      url.includes('/comments')
        ? ok({
            data: [{ username: 'fan', text: '재밌어요', timestamp: '2026-10-17T01:00:00+0000' }],
          })
        : ok({
            data: [
              {
                id: '17900001',
                caption: '시즌 2 개막\n두 줄',
                media_type: 'REELS',
                timestamp: '2026-10-17T01:00:00+0000',
                like_count: 9,
                comments_count: 2,
                insights: { data: [{ name: 'views', values: [{ value: 300 }] }] },
              },
            ],
          }),
    );
    const env = { META_ADS_ACCESS_TOKEN: 'a', META_IG_USER_ID: '178' } as unknown as Env;
    const [ig] = socialTools(env, 'reply', fetcher as unknown as typeof fetch);
    expect(await ig!.run({ view: 'posts', limit: 50 })).toBe(
      '올린 때(KST) | 종류 | 좋아요 | 댓글 | 인사이트 | 첫 줄 | ID\n10-17 10:00 | REELS | 9 | 2 | views 300 | 시즌 2 개막 두 줄 | 17900001',
    );
    expect(String(fetcher.mock.calls[0]![0])).toContain('limit=12');
    expect(await ig!.run({ view: 'comments', media_id: '../me' })).toContain('media_id가 필요해요');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(await ig!.run({ view: 'comments', media_id: '17900001' })).toBe(
      '10-17 10:00 @fan (좋아요 0): 재밌어요',
    );
  });

  it('Threads 글마다 지표를 붙이고, 한 글의 지표가 막혀도 나머지는 보인다', async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url.includes('/me/threads?'))
        return ok({
          data: [
            { id: '111', text: '테스터 88명 감사', timestamp: '2026-10-18T00:00:00+0000' },
            { id: '222', text: '러닝', timestamp: '2026-10-15T00:00:00+0000' },
          ],
        });
      if (url.includes('/111/insights'))
        return ok({ data: [{ name: 'views', values: [{ value: 500 }] }] });
      return new Response(JSON.stringify({ error: { message: 'nope' } }), { status: 400 });
    });
    const env = { THREADS_ACCESS_TOKEN: 'th-secret1' } as unknown as Env;
    const [th] = socialTools(
      env,
      'mention',
      fetcher as unknown as typeof fetch,
      () => NOW,
      noStore,
    );
    expect(await th!.run({ view: 'posts' })).toBe(
      '올린 때(KST) | 지표 | 첫 줄 | ID\n10-18 09:00 | views 500 | 테스터 88명 감사 | 111\n10-15 09:00 | 지표 없음 | 러닝 | 222',
    );
  });

  it('Threads는 원장의 갱신 토큰을 쓰되, 비밀값이 바뀌면 새 비밀값을 쓴다', async () => {
    const fetcher = vi.fn(async (_url: string, _init?: RequestInit) => ok({ data: [] }));
    const saved: SocialToken = { token: 'refreshed', at: NOW, from: 'secret01' };
    const store = { socialToken: async () => saved };
    const auth = () =>
      (fetcher.mock.calls.at(-1)![1] as unknown as { headers: Record<string, string> }).headers
        .Authorization;
    const run = (secret: string) =>
      socialTools(
        { THREADS_ACCESS_TOKEN: secret } as unknown as Env,
        'mention',
        fetcher as unknown as typeof fetch,
        () => NOW,
        store,
      )[0]!.run({ view: 'account' });
    await run('old-secret01');
    expect(auth()).toBe('Bearer refreshed');
    await run('new-secret02');
    expect(auth()).toBe('Bearer new-secret02');
  });

  it('Threads 토큰은 7일마다 갱신해 원장에 둔다', async () => {
    const env = { THREADS_ACCESS_TOKEN: 'th-secret1' } as unknown as Env;
    let saved: SocialToken | undefined;
    const store = {
      socialToken: async () => saved,
      setSocialToken: async (_kind: string, v: SocialToken) => {
        saved = v;
      },
    };
    const fetcher = vi.fn(async (_url: string) =>
      ok({ access_token: 'new', expires_in: 5_184_000 }),
    );
    expect(await refreshSocialToken('threads', {} as Env, NOW, fetcher as never, store)).toBe(
      'no token',
    );
    expect(await refreshSocialToken('threads', env, NOW, fetcher as never, store)).toBe(
      'refreshed',
    );
    expect(String(fetcher.mock.calls[0]![0])).toContain('access_token=th-secret1');
    expect(saved).toEqual({ token: 'new', at: NOW, from: 'h-secret1'.slice(-8) });
    expect(
      await refreshSocialToken('threads', env, NOW + 6 * 86_400_000, fetcher as never, store),
    ).toBe('fresh');
    expect(
      await refreshSocialToken('threads', env, NOW + 8 * 86_400_000, fetcher as never, store),
    ).toBe('refreshed');
    expect(String(fetcher.mock.calls[1]![0])).toContain('access_token=new');
  });

  it('Instagram 로그인 토큰이 있으면 graph.instagram.com의 me로 읽고 원장의 갱신 토큰을 쓴다 (T-11-397)', async () => {
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer ig-new');
      if (url.includes('/insights'))
        return ok({ data: [{ name: 'reach', total_value: { value: 42 } }] });
      return ok({ username: 'offside.lab.kr', followers_count: 15, media_count: 13 });
    });
    const env = {
      INSTAGRAM_ACCESS_TOKEN: 'ig-secret01',
      META_GRAPH_TOKEN: 'g',
      META_IG_USER_ID: '178',
    } as unknown as Env;
    const store = {
      socialToken: async (kind: string) =>
        kind === 'instagram' ? { token: 'ig-new', at: NOW, from: 'secret01' } : undefined,
    };
    const [ig] = socialTools(env, 'mention', fetcher as unknown as typeof fetch, () => NOW, store);
    expect(await ig!.run({ view: 'account', days: 7 })).toBe(
      '@offside.lab.kr 팔로워 15 · 게시물 13\n지난 7일: reach 42',
    );
    expect(String(fetcher.mock.calls[0]![0])).toMatch(
      /^https:\/\/graph\.instagram\.com\/v21\.0\/me\?/,
    );
    expect(String(fetcher.mock.calls[1]![0])).toContain('graph.instagram.com/v21.0/me/insights');
  });

  it('Instagram 로그인 토큰은 ig_refresh_token으로 갱신해 instagram 칸에 둔다', async () => {
    const env = { INSTAGRAM_ACCESS_TOKEN: 'ig-secret01' } as unknown as Env;
    const writes: [string, SocialToken][] = [];
    const store = {
      socialToken: async () => undefined,
      setSocialToken: async (kind: string, v: SocialToken) => {
        writes.push([kind, v]);
      },
    };
    const fetcher = vi.fn(async (_url: string) => ok({ access_token: 'ig-new' }));
    expect(await refreshSocialToken('instagram', env, NOW, fetcher as never, store)).toBe(
      'refreshed',
    );
    const url = String(fetcher.mock.calls[0]![0]);
    expect(url).toContain('graph.instagram.com/refresh_access_token');
    expect(url).toContain('grant_type=ig_refresh_token');
    expect(writes).toEqual([['instagram', { token: 'ig-new', at: NOW, from: 'secret01' }]]);
    expect(await refreshSocialToken('threads', env, NOW, fetcher as never, store)).toBe('no token');
  });
});
