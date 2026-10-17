import { setStorage } from '@offside/game/storage';
import type { GameState } from '@offside/game/types';
import { describe, expect, it } from 'vitest';
import { applyRename, renameDraft } from './rename';

describe('T-11-377 선수 이름 변경권', () => {
  it('보낼 이름을 다듬고, 빈 이름 · 쓸 수 없는 이름 · 같은 이름은 막는다', () => {
    expect(renameDraft('  새이름 ', '옛이름')).toEqual({ ok: true, name: '새이름' });
    expect(renameDraft('   ', '옛이름')).toEqual({ ok: false, message: '이름을 넣어 주세요.' });
    expect(renameDraft('열세글자이름입니다아아아아', '옛이름').ok).toBe(false);
    expect(renameDraft('http://x.co', '옛이름').ok).toBe(false);
    expect(renameDraft('옛이름 ', '옛이름')).toEqual({ ok: false, message: '지금 이름과 같아요.' });
  });

  it('이 기기의 명예의 전당 · 이름표 · 진행 중 세이브를 같은 이름으로 맞춘다', () => {
    const m = new Map<string, string>();
    setStorage({ getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) });
    m.set('ft_hof', JSON.stringify([{ id: 'c1', name: '옛이름', public: false, score: 1 }]));
    m.set('ft_names', JSON.stringify({ c1: '옛이름', c2: '다른선수' }));
    expect(applyRename('c1', '새이름', null)).toBe(false);
    expect(JSON.parse(m.get('ft_hof')!)[0]).toMatchObject({
      id: 'c1',
      name: '새이름',
      public: true,
    });
    expect(JSON.parse(m.get('ft_names')!)).toEqual({ c1: '새이름', c2: '다른선수' });

    const game = { cid: 'c3', name: '진행중' } as GameState;
    expect(applyRename('c3', '바뀐이름', game)).toBe(true);
    expect(game.name).toBe('바뀐이름');
    expect(applyRename('c9', '남의이름', game)).toBe(false);
    expect(game.name).toBe('바뀐이름');
  });
});
