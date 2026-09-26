import { describe, expect, it, vi } from 'vitest';
// @ts-expect-error -- $state가 쓰는 Svelte 내부 proxy(). 공개 타입 선언이 없다.
import { proxy } from 'svelte/internal/client';
import { newGame } from '../game/engine.js';
import { createRng, setActiveRng } from '../game/rng.js';
import type { GameState } from '../game/types.js';
import { pushEvLog } from './helpers.js';

// helpers.ts가 읽는 룬 상태 모듈(.svelte.ts)은 이 테스트 환경에서 컴파일하지 않는다.
vi.mock('./state.svelte.js', () => ({ appState: {}, toastState: {} }));

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
