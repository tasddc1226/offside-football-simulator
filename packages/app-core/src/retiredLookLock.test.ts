import { beforeEach, expect, it } from 'vitest';
import { saveKey, setStorage } from '@offside/game/storage';
import { lookButtonLabel, rememberLookLock, retiredLookLockOf } from './retiredLookLock.js';

// T-11-439 B5 은퇴 리포트의 꾸미기 버튼은 서버를 따로 부르지 않고, 편집기가 본 정책·이 기기 영수증만 쓴다.
let values: Map<string, string>;
beforeEach(() => {
  values = new Map();
  setStorage({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  });
});

const own = { id: undefined } as never;

it('모르는 서버 기록은 남은 1회로 보여 주고, 편집기가 확인한 잠김은 이번 접속 동안 기억한다', () => {
  const v = { avatarId: 'srv-1', own: { id: 'srv-1' } as never };
  expect(retiredLookLockOf(v)).toBeUndefined();
  expect(lookButtonLabel(retiredLookLockOf(v))).toBe('꾸미기 (1회)');
  rememberLookLock('srv-1', 'transferred');
  expect(lookButtonLabel(retiredLookLockOf(v))).toBe('꾸미기 불가');
  rememberLookLock('srv-1', 'used');
  expect(lookButtonLabel(retiredLookLockOf(v))).toBe('꾸미기 (사용함)');
  rememberLookLock('srv-1', null);
  expect(retiredLookLockOf(v)).toBeNull();
});

it('서버에 없는 옛 기록은 이 기기 영수증으로 판단한다(도트 시절 영수증은 한 번 더)', () => {
  const v = { avatarId: 'local-1', own };
  expect(retiredLookLockOf(v)).toBeNull();
  saveKey('ft_retired_look:local-1', { used: true, look: 'y6' });
  expect(retiredLookLockOf(v)).toBeNull();
  saveKey('ft_retired_look:local-1', { used: true, look: 'y6', round: 2 });
  expect(retiredLookLockOf(v)).toBe('used');
});

it('아바타가 없으면 모른다', () => {
  expect(retiredLookLockOf({ avatarId: null, own: null } as never)).toBeUndefined();
});
