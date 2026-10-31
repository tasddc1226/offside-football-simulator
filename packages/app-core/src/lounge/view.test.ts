import { describe, expect, it } from 'vitest';
import { setStorage } from '@offside/game/storage';
import { currentLoungeView, setLoungeView } from './view.js';

describe('T-11-600 라운지 보기', () => {
  it('처음에는 필드로 보고, 고른 보기를 기억한다', () => {
    const store = new Map<string, string>();
    setStorage({ getItem: (k) => store.get(k) ?? null, setItem: (k, v) => void store.set(k, v) });
    expect(currentLoungeView()).toBe('field');
    setLoungeView('chat');
    expect(currentLoungeView()).toBe('chat');
    setLoungeView('field');
    expect(currentLoungeView()).toBe('field');
  });
});
