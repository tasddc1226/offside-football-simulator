import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setStorage } from '@offside/game/storage';
import { MANAGER_SAVE_KEY } from '@offside/game/manager';
import { saveKey } from '@offside/game/storage';
import { MANAGER_RESUME_KEY, managerResume } from './managerResume.js';

describe('감독 커리어 이어 하기 카드 (T-11-338)', () => {
  beforeEach(() => {
    const m = new Map<string, string>();
    setStorage({ getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) });
  });
  afterEach(() => saveKey(MANAGER_RESUME_KEY, null));

  it('엔진 세이브 키와 같은 키를 읽는다', () => {
    expect(MANAGER_RESUME_KEY).toBe(MANAGER_SAVE_KEY);
  });

  it('세이브가 없거나 모양이 다르면 null', () => {
    expect(managerResume()).toBeNull();
    saveKey(MANAGER_RESUME_KEY, { foo: 1 });
    expect(managerResume()).toBeNull();
  });

  it('구단 · 지금 시즌 · 총 시즌 · 확정 대기를 읽는다', () => {
    saveKey(MANAGER_RESUME_KEY, {
      id: 'mgr_x',
      name: '홍길동',
      club: { name: '토트넘' },
      season: 3,
      seasonsTotal: 9,
      phase: 'event',
    });
    expect(managerResume()).toEqual({
      name: '홍길동',
      club: '토트넘',
      n: 4,
      total: 9,
      done: false,
    });
    saveKey(MANAGER_RESUME_KEY, {
      id: 'mgr_x',
      name: null,
      club: null,
      season: 9,
      seasonsTotal: 9,
      phase: 'done',
    });
    expect(managerResume()).toEqual({ name: null, club: null, n: 9, total: 9, done: true });
  });
});
