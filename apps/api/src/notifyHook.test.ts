import { afterEach, describe, expect, it, vi } from 'vitest';
import { notifyHook, postNotify } from './notifyHook.js';

afterEach(() => vi.unstubAllGlobals());

describe('notifyHook (T-11-576)', () => {
  it('디스코드 웹훅만 받는다', () => {
    expect(notifyHook('https://hooks.slack.com/services/T/B/x')).toBeNull();
    expect(notifyHook('https://discord.com/api/webhooks/123/ab-C_d')).not.toBeNull();
    expect(notifyHook('https://discord.com/api/channels/1/messages')).toBeNull();
    expect(notifyHook('https://evil.example/api/webhooks/1/x')).toBeNull();
    expect(notifyHook(undefined)).toBeNull();
  });

  it('디스코드에는 멘션을 끈 글 하나로 보내고 204를 성공으로 본다', async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetcher);
    const hook = notifyHook('https://discord.com/api/webhooks/123/abc')!;
    expect(await postNotify(hook, { text: '결제 @everyone' })).toBe(true);
    expect(
      JSON.parse(String((fetcher.mock.calls[0] as unknown as [URL, RequestInit])[1].body)),
    ).toEqual({
      content: '결제 @everyone',
      allowed_mentions: { parse: [] },
      flags: 4,
    });
  });

  it('실패 응답은 실패로 본다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('bad', { status: 400 })),
    );
    expect(
      await postNotify(notifyHook('https://discord.com/api/webhooks/1/x')!, { text: 'a' }),
    ).toBe(false);
  });
});
