import { describe, expect, it } from 'vitest';
import { peakEndAge } from '@offside/game/care';
import { newGame } from '@offside/game/engine';
import { createRng, setActiveRng } from '@offside/game/rng';
import type { GameState } from '@offside/game/types';
import { doPrime, primeView } from './prime-view';

function vet(money = 1e7): GameState {
  setActiveRng(createRng(5));
  const s = newGame(
    { name: 'a', number: 9, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'normal' },
    5,
  );
  s.age = peakEndAge(s) - 1;
  s.money = money;
  return s;
}

describe('T-11-733 전성기 연장 카드', () => {
  it('정점 나이 1년 전 전에는 숨긴다', () => {
    const s = vet();
    s.age -= 1;
    expect(primeView(s)).toBeNull();
  });

  it('자금이 있으면 도전 버튼, 시도 뒤엔 결과와 기록을 보인다', () => {
    const s = vet();
    const v = primeView(s)!;
    expect(v.status).toBe('ready');
    expect(v.button).toBeTruthy();
    expect(v.adButton).toBeUndefined();
    const out = doPrime(s)!;
    expect(out.head).toBeTruthy();
    expect(out.max).toBe(3);
    const after = primeView(s)!;
    expect(after.button).toBeUndefined();
    expect(after.history).toHaveLength(1);
  });

  it('자금이 모자라면 앱에서만 광고 버튼이 생긴다', () => {
    const s = vet(0);
    expect(primeView(s)!.adButton).toBeUndefined();
    expect(primeView(s, 'ad')!.adButton).toBeTruthy();
    expect(primeView(s, 'free')!.adBadge).not.toContain('광고');
  });
});
