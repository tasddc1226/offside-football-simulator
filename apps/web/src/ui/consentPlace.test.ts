import { describe, expect, it } from 'vitest';
import { consentHere } from './consentPlace.js';

describe('T-11-437 동의 창 자리', () => {
  it('홈에서만 묻고 선수 생성 · 게임 · 환경설정에서는 띄우지 않는다', () => {
    expect(consentHere('home')).toBe(true);
    for (const s of ['create', 'game', 'settings', 'owner', 'shared'] as const)
      expect(consentHere(s)).toBe(false);
  });
});
