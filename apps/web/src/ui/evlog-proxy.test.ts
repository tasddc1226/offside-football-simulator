import { describe, expect, it } from 'vitest';
// @ts-expect-error -- $state가 쓰는 Svelte 내부 proxy(). 공개 타입 선언이 없다.
import { proxy } from 'svelte/internal/client';
import { newGame } from '@offside/game/engine';
import { createRng, setActiveRng } from '@offside/game/rng';
import type { GameState } from '@offside/game/types';
import { pushEvLog } from '@offside/app-core/career';

describe('pushEvLog', () => {
  // 앱은 게임 상태를 Svelte $state(깊은 프록시)로 들고 있다 — 새로 만든 버퍼의 첫 항목이 사라지면 안 된다.
  it('Svelte $state 프록시 상태에서도 첫 선택 로그를 남긴다', () => {
    setActiveRng(createRng(1));
    const app = proxy({ G: null as GameState | null });
    app.G = newGame(
      { name: 'a', number: 1, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late' },
      1,
    );
    const entry = { k: 'ev', id: 'knock', c: 0, h: 1 };
    pushEvLog(app.G, entry);
    pushEvLog(app.G, entry);
    expect(app.G.evBuf).toHaveLength(2);
  });
});
