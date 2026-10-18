import { beforeEach, describe, expect, it } from 'vitest';
import { setStorage } from '@offside/game/storage';
import { noteOwner, ownerHintState, recheckOwner } from './friendPending.js';

// T-11-388 구단주에게만 가는 푸시로 홈을 열면 '로그인 필요' 표시만 '모름'으로 되돌린다.
describe('recheckOwner', () => {
  beforeEach(() => {
    const m = new Map<string, string>();
    setStorage({ getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) });
  });

  it("'로그인 필요'를 '모름'으로 되돌린다", () => {
    noteOwner(false);
    expect(ownerHintState()).toBe(false);
    recheckOwner();
    expect(ownerHintState()).toBeNull();
  });

  it('구단주 · 모름 표시는 그대로 둔다', () => {
    recheckOwner();
    expect(ownerHintState()).toBeNull();
    noteOwner(true);
    recheckOwner();
    expect(ownerHintState()).toBe(true);
  });
});
