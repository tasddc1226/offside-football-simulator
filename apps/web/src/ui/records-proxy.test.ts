import { describe, expect, it } from 'vitest';
// @ts-expect-error -- $state가 쓰는 Svelte 내부 proxy(). 공개 타입 선언이 없다.
import { proxy } from 'svelte/internal/client';
import { newGame } from '@offside/game/engine';
import { createRng, setActiveRng } from '@offside/game/rng';
import { detectCareerHighs } from '@offside/game/records';
import type { CareerRecord, GameState } from '@offside/game/types';

// T-11-001 게임 엔진이 packages/game으로 옮겨 가며, 웹의 Svelte 상태에 얹혀서도 도는지는 웹에서 본다.
const makeRec = (over: Partial<CareerRecord>): CareerRecord => ({
  year: 2026,
  age: 18,
  club: 'test',
  league: 'K리그1',
  apps: 0,
  goals: 0,
  assists: 0,
  cs: 0,
  rating: 0,
  rank: 1,
  ovr: 60,
  honors: [],
  pro: true,
  ...over,
});

describe('detectCareerHighs', () => {
  it('Svelte $state 프록시로 감싼 상태에서도 CH를 잡는다', () => {
    setActiveRng(createRng(1));
    const app = proxy({ G: null as GameState | null });
    app.G = newGame(
      { name: 'a', number: 1, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late' },
      1,
    );
    app.G.career.push(makeRec({ year: 2026, goals: 5 }));
    const rec2 = makeRec({ year: 2027, goals: 12 });
    app.G.career.push(rec2);
    expect(detectCareerHighs(app.G, rec2)).toContain('goals');
  });
});
