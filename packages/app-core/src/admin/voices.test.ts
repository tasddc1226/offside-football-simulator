import type { AdminVoice, AdminVoiceList } from '@offside/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyVoiceResolve, resolveVoicesAll, voiceMeta, voiceProfileShort } from './voices.js';

const voice = (over: Partial<AdminVoice> = {}): AdminVoice => ({
  id: 'vox_1',
  kind: 'bug',
  body: '본문',
  screen: 'settings',
  platform: 'ios',
  version: '1.1.7 (45) · abcd1234',
  device: 'ios 18.1',
  lang: 'ja',
  createdAt: '2026-11-21T00:00:00.000Z',
  resolvedAt: null,
  profileId: 'prf_0f3a9c1e-4b7d-4e2a-9f1c-0a1b2c3d4e5f',
  linked: true,
  ...over,
});

afterEach(() => vi.unstubAllGlobals());

describe('T-11-802 운영 도구 유저 의견', () => {
  it('한 줄 정보: KST 시각 · 기기 종류 · 버전 · 기기 · 입구 · 언어 · 로그인 여부', () => {
    expect(voiceMeta(voice())).toBe(
      '26.11.21 09:00 · iOS · 1.1.7 (45) · abcd1234 · ios 18.1 · 설정 · 일본어 · 로그인 구단주',
    );
    expect(
      voiceMeta(voice({ platform: 'web', device: null, screen: null, lang: 'ko', linked: false })),
    ).toBe('26.11.21 09:00 · 웹 · 1.1.7 (45) · abcd1234 · 한국어 · 익명');
    expect(voiceProfileShort(voice().profileId)).toBe('0f3a9c1e');
  });

  it('처리하면 열린 목록에서는 그 행을 빼고, 전체 목록에서는 처리 시각만 바꾼다', () => {
    const list: AdminVoiceList = {
      items: [voice({ id: 'a' }), voice({ id: 'b' }), voice({ id: 'c' })],
      hasMore: false,
      open: 7,
    };
    const at = '2026-11-21T01:00:00.000Z';
    const open = applyVoiceResolve(
      list,
      { ids: ['a', 'c'], resolved: true, updated: 2, at },
      'open',
    );
    expect(open.items.map((v) => v.id)).toEqual(['b']);
    expect(open.open).toBe(5);
    const all = applyVoiceResolve(list, { ids: ['a'], resolved: true, updated: 1, at }, 'all');
    expect(all.items.map((v) => v.resolvedAt)).toEqual([at, null, null]);
    const reopened = applyVoiceResolve(all, { ids: ['a'], resolved: false, updated: 1, at }, 'all');
    expect(reopened.items[0]!.resolvedAt).toBeNull();
    expect(reopened.open).toBe(7);
  });

  it('모두 처리는 50개씩 나눠 보내고, 실패하면 거기서 멈춘다', async () => {
    const ids = Array.from({ length: 120 }, (_, i) => `vox_${i}`);
    const bodies: { ids: string[] }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body)) as { ids: string[] };
        bodies.push(body);
        return new Response(JSON.stringify({ data: { updated: body.ids.length }, meta: {} }), {
          status: 200,
        });
      }),
    );
    expect(await resolveVoicesAll(ids, true)).toEqual({ ok: true, updated: 120 });
    expect(bodies.map((b) => b.ids.length)).toEqual([50, 50, 20]);

    let n = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        ++n === 1
          ? new Response(JSON.stringify({ data: { updated: 50 }, meta: {} }), { status: 200 })
          : new Response(
              JSON.stringify({
                error: { code: 'FORBIDDEN', message: '운영자만 할 수 있어요.', retryable: false },
                meta: {},
              }),
              { status: 403 },
            ),
      ),
    );
    expect(await resolveVoicesAll(ids, true)).toEqual({
      ok: false,
      updated: 50,
      message: '운영자만 할 수 있어요.',
    });
  });
});
