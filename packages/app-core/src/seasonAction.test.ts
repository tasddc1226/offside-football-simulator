import { describe, expect, it } from 'vitest';
import { newGame } from '@offside/game/engine';
import { createRng, setActiveRng } from '@offside/game/rng';
import { seasonAction } from './seasonAction.js';

function game() {
  setActiveRng(createRng(7));
  return newGame(
    { name: 'T', number: 9, pos: 'FW', foot: '오른발', type: 'target', trait: 'early' },
    7,
  );
}

describe('seasonAction', () => {
  it('프리시즌에는 훈련 진행과 준비 요약(훈련·자기 투자·컨디션)', () => {
    const s = game();
    s.training = 'rest';
    s.invest = 'mental';
    s.cond = 81.6;
    const a = seasonAction(s);
    expect(a.kind).toBe('advance');
    expect(a.label).toBe('프리시즌 훈련 진행');
    expect(a.kind === 'advance' && a.prep).toMatch(/^훈련 .+ · 투자 멘탈 코칭 · 컨디션 82$/);
    s.invest = 'none';
    expect(seasonAction(s)).toMatchObject({ prep: expect.stringMatching(/ · 투자 없음 · /) });
  });

  it('이적시장 대기는 팀 선택으로 돌아가고 결산이 남으면 결산부터 연다', () => {
    const s = game();
    s.pending = { type: 'market', res: null, m: null };
    expect(seasonAction(s)).toEqual({ kind: 'pending', label: '이적할 팀 선택하기' });
    s.pending.res = {} as never;
    expect(seasonAction(s)).toEqual({ kind: 'pending', label: '시즌 결산 보기' });
  });

  it('대기 중인 이벤트·시즌 결산은 요약 없이 그걸 여는 버튼', () => {
    const s = game();
    s.pending = { type: 'event', id: 'x' } as never;
    expect(seasonAction(s)).toEqual({ kind: 'pending', label: '⚡ 이벤트 확인' });
    s.pending = { type: 'season' } as never;
    expect(seasonAction(s)).toEqual({ kind: 'pending', label: '시즌 결산 보기' });
  });
});
