import { describe, expect, it, vi } from 'vitest';
import type { Env } from './env.ts';
import { checkStoreVersions, compareVersions, playVersion, versionNotes } from './storeVersion.ts';

const post = vi.hoisted(() => vi.fn(async () => ({})));
vi.mock('./chat.ts', () => ({ chatClient: () => post }));
vi.mock('./reviews.ts', () => ({ playAccount: () => ({ email: 'x', key: 'k' }) }));
vi.mock('./google.ts', () => ({ serviceAccountToken: async () => 'g' }));

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const env = {
  API_BASE: 'https://api.test',
  ASC_APP_ID: '1',
  PLAY_PACKAGE: 'pkg',
  DESK_CHANNEL: 'desk',
} as unknown as Env;

/** 서버 · App Store · Play 응답을 흉내 낸다. Play에 지운 편집을 기록한다. */
function stubs(opts: { latest?: string; ios?: string; playFails?: boolean } = {}) {
  const deleted: string[] = [];
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/v1/app/version'))
      return ok({
        data: {
          ios: { latest: opts.latest ?? '1.1.6' },
          android: { latest: opts.latest ?? '1.1.6' },
        },
      });
    if (url.includes('itunes.apple.com'))
      return ok({ results: [{ version: opts.ios ?? '1.1.6' }] });
    if (opts.playFails) return new Response('no', { status: 403 });
    if (init?.method === 'DELETE') {
      deleted.push(url);
      return new Response(null, { status: 204 });
    }
    if (url.endsWith('/edits')) return ok({ id: 'e1' });
    return ok({ releases: [{ name: '1.1.6 (24)', status: 'completed' }] });
  });
  return { fetcher: fetcher as unknown as typeof fetch, deleted };
}

describe('스토어 출시 감지 (T-11-609)', () => {
  it('버전은 숫자로 비교한다', () => {
    expect(compareVersions('1.1.10', '1.1.9')).toBeGreaterThan(0);
    expect(compareVersions('1.1.6', '1.1.6')).toBe(0);
  });

  it('트랙에서 전체 공개 최고 버전과 단계적 출시를 고른다', () => {
    expect(
      playVersion([
        { name: '1.1.5 (23)', status: 'completed' },
        { name: '1.1.6 (24)', status: 'completed' },
        { name: '1.1.7 (25)', status: 'inProgress', userFraction: 0.2 },
        { name: '1.1.8 (26)', status: 'draft' },
      ]),
    ).toEqual({ version: '1.1.6', staged: { version: '1.1.7', fraction: 0.2 } });
    expect(playVersion([{ name: '이름 없음', status: 'completed' }])).toBeNull();
  });

  it('같으면 조용하고, 단계적 출시 중에는 올리라고 하지 않는다', () => {
    const latest = { ios: '1.1.6', android: '1.1.6' };
    expect(versionNotes(latest, { ios: { version: '1.1.6' } })).toEqual([]);
    expect(
      versionNotes(latest, {
        android: { version: '1.1.6', staged: { version: '1.1.7', fraction: 0.2 } },
      }),
    ).toEqual([]);
  });

  it('스토어가 앞서거나 뒤처지면 어느 쪽인지 알린다', () => {
    const latest = { ios: '1.1.6', android: '1.1.7' };
    const notes = versionNotes(latest, {
      ios: { version: '1.1.7' },
      android: { version: '1.1.6', staged: { version: '1.1.7', fraction: 0.2 } },
    });
    expect(notes[0]).toContain('App Store: 스토어는 1.1.7');
    expect(notes[1]).toContain('Google Play: 스토어는 1.1.6 (1.1.7 단계적 출시 20%)');
  });

  it('다르면 운영 채널에 올리고, Play 임시 편집은 지운다', async () => {
    post.mockClear();
    const { fetcher, deleted } = stubs({ ios: '1.1.7' });
    const r = await checkStoreVersions(env, { fetcher });
    expect(r.notes).toHaveLength(1);
    expect(post).toHaveBeenCalledOnce();
    expect(deleted).toEqual([
      'https://androidpublisher.googleapis.com/androidpublisher/v3/applications/pkg/edits/e1',
    ]);
  });

  it('같거나 dry면 올리지 않는다', async () => {
    post.mockClear();
    expect((await checkStoreVersions(env, { fetcher: stubs().fetcher })).notes).toEqual([]);
    await checkStoreVersions(env, { dry: true, fetcher: stubs({ ios: '1.1.7' }).fetcher });
    expect(post).not.toHaveBeenCalled();
  });

  it('Play를 못 읽어도 App Store는 보고 오류를 돌려준다', async () => {
    post.mockClear();
    const r = await checkStoreVersions(env, {
      fetcher: stubs({ ios: '1.1.7', playFails: true }).fetcher,
    });
    expect(r.errors[0]).toContain('android');
    expect(r.notes).toHaveLength(1);
    expect(post).toHaveBeenCalledOnce();
  });
});
