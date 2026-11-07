import { beforeEach, expect, it, vi } from 'vitest';
// T-11-669 은퇴 화면 실험이 옛(5분 지난) 계정 캐시로 군을 정하지 않게: freshAccount는 다시 확인이 끝날 때까지 기다리고,
// 계정 ID가 바뀌면 세대를 올려 기다리던 배정을 버리게 한다. 캐시가 신선하면 새로 묻지 않는다.
// 단위 테스트는 svelte 컴파일 없이 돌아서 $state를 그대로 값으로 둔다(반응성은 여기서 보지 않는다).
const { getProfile } = vi.hoisted(() => {
  Reflect.set(globalThis, '$state', <T>(v: T) => v);
  return { getProfile: vi.fn() };
});
vi.mock('@offside/app-core/api/client', () => ({ getProfile }));
vi.mock('@offside/app-core/api/friendPending', () => ({ noteOwner: vi.fn() }));
import {
  accountCache,
  accountFresh,
  accountGeneration,
  freshAccount,
  onAccountChange,
} from './account-state.svelte.js';

const prof = (id: string) => ({
  ok: true,
  data: { id, linked: { google: false, apple: false, toss: false } },
});
beforeEach(() => {
  getProfile.mockReset();
  accountCache.value = undefined;
  accountCache.fetchedAt = 0;
});

it('처음이면 확인을 기다리고, 신선한 캐시면 다시 묻지 않는다', async () => {
  getProfile.mockResolvedValueOnce(prof('A'));
  await freshAccount();
  expect(accountFresh()).toBe(true);
  expect((accountCache.value as { id: string }).id).toBe('A');
  await freshAccount();
  expect(getProfile).toHaveBeenCalledTimes(1);
});

it('5분 지난 캐시는 다시 확인이 끝날 때까지 기다린 뒤 새 계정을 보고, 세대가 오르며 알린다', async () => {
  getProfile.mockResolvedValueOnce(prof('A'));
  await freshAccount();
  const gen = accountGeneration();
  accountCache.fetchedAt = Date.now() - 6 * 60_000;
  expect(accountFresh()).toBe(false);
  let resolve!: (v: unknown) => void;
  getProfile.mockReturnValueOnce(new Promise((r) => (resolve = r)));
  const seen: string[] = [];
  const off = onAccountChange(() => seen.push((accountCache.value as { id: string }).id));
  const wait = freshAccount();
  // 다시 확인하는 동안에는 옛 캐시(A)가 남아 있지만 신선하지 않다.
  expect((accountCache.value as { id: string }).id).toBe('A');
  expect(accountFresh()).toBe(false);
  resolve(prof('B'));
  await wait;
  off();
  expect((accountCache.value as { id: string }).id).toBe('B');
  expect(accountFresh()).toBe(true);
  expect(accountGeneration()).toBe(gen + 1);
  expect(seen).toEqual(['B']);
});

it('같은 계정을 다시 확인하면 세대가 그대로다', async () => {
  getProfile.mockResolvedValue(prof('A'));
  await freshAccount();
  const gen = accountGeneration();
  accountCache.fetchedAt = 0;
  await freshAccount();
  expect(accountGeneration()).toBe(gen);
});
