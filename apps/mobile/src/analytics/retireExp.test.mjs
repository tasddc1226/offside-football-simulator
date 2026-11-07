// T-11-669 앱 계측의 계정 구독 · 결과 귀속 연결. 실제 valtio로 계정 캐시를 바꿔, 계측이 원래 ID가 아니라 계정 키로
// 계정 변경을 받는지(로그인 · 로그아웃 · 다른 계정) 본다. 구단 결과 신호는 요청 당시 계정 키와 함께 넘어간다.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const f = vi.hoisted(() => ({ values: new Map() }));
vi.mock('expo-constants', () => ({ default: { expoConfig: { version: '1.0.0', extra: {} } } }));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('../platform/setup', () => ({
  kv: {
    getString: (k) => f.values.get(k),
    set: (k, v) => f.values.set(k, v),
    remove: (k) => f.values.delete(k),
  },
}));
vi.mock('../store', async () => {
  const { proxy } = await import('valtio');
  return { accountCache: proxy({ value: undefined, fetchedAt: 0 }) };
});

const { accountCache } = await import('../store');
const { retireExp } = await import('./index');
const { profileKey } = await import('@offside/app-core/retireExperiment');
const { signalOn } = await import('@offside/app-core/clubSignals');
const tick = () => new Promise((r) => setTimeout(r, 0));
const prof = (id) => ({ id, linked: { google: false, apple: false, toss: false } });

describe('mobile retire experiment account wiring', () => {
  beforeEach(async () => {
    accountCache.value = undefined;
    await tick();
    vi.restoreAllMocks();
  });

  it('forwards every account change to the metrics as a key, never the raw id', async () => {
    const account = vi.spyOn(retireExp, 'account');
    accountCache.value = prof('raw-A');
    await tick();
    accountCache.value = null; // 로그아웃
    await tick();
    accountCache.value = prof('raw-B');
    await tick();
    accountCache.value = 'error'; // 연결 실패는 모름
    await tick();
    expect(account.mock.calls.map((c) => c[0])).toEqual([
      profileKey('raw-A'),
      null,
      profileKey('raw-B'),
      undefined,
    ]);
    expect(JSON.stringify(account.mock.calls)).not.toContain('raw-');
  });

  it('passes the account key captured when a club request was sent', async () => {
    const club = vi.spyOn(retireExp, 'club');
    accountCache.value = prof('raw-A');
    await tick();
    let resolve;
    const pending = signalOn(new Promise((r) => (resolve = r)), 'club_match');
    accountCache.value = prof('raw-B'); // 응답 전에 계정이 바뀜
    await tick();
    resolve({ ok: true });
    await pending;
    expect(club).toHaveBeenCalledWith('club_match', profileKey('raw-A'));
  });
});
