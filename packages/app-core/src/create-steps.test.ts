import { describe, expect, it } from 'vitest';
import { DETAILS_OF } from '@offside/contracts/positions';
import { POS, type AttrKey } from '@offside/game/data';
import {
  candidateEdge,
  detailBlurb,
  createProgressAt,
  nextCreateStep,
  numberInvalid,
  parseCreateDraft,
  positionTendency,
  prevCreateStep,
} from './create-steps.js';

const attrs = (o: Partial<Record<AttrKey, number>>) =>
  ({ sho: 50, pac: 50, dri: 50, pas: 50, def: 50, phy: 50, ...o }) as Record<AttrKey, number>;

describe('단계 순서', () => {
  it('포지션 → 주력 → 특성 → 정보로 가고, 정보 · 더 꾸미기 다음은 후보다', () => {
    expect(nextCreateStep('pos')).toBe('focus');
    expect(nextCreateStep('trait')).toBe('info');
    expect(nextCreateStep('info')).toBeNull();
    expect(nextCreateStep('extra')).toBeNull();
  });
  it('더 꾸미기의 이전은 정보이고, 첫 단계의 이전은 없다', () => {
    expect(prevCreateStep('extra')).toBe('info');
    expect(prevCreateStep('focus')).toBe('pos');
    expect(prevCreateStep('pos')).toBeNull();
  });
  it('진행 표시에서 더 꾸미기는 정보 칸이고, 후보가 있으면 후보 칸이다', () => {
    expect(createProgressAt('extra', false)).toBe('info');
    expect(createProgressAt('pos', true)).toBe('candidates');
  });
});

describe('등번호 검사', () => {
  it('비어 있으면 괜찮고, 1~99 밖이나 소수는 막는다', () => {
    for (const v of [null, undefined, '', 1, 99, '10']) expect(numberInvalid(v)).toBe(false);
    for (const v of [0, 100, -1, 1.5, '100']) expect(numberInvalid(v)).toBe(true);
  });
});

describe('세부 포지션 설명', () => {
  it('고를 수 있는 세부 포지션은 설명이 모두 다르다', () => {
    const blurbs = Object.values(DETAILS_OF).flat().map(detailBlurb);
    expect(new Set(blurbs).size).toBe(blurbs.length);
  });
  it('골 · 도움 비중은 실제 배수를 따른다', () => {
    expect(positionTendency('FW', 'ST')).toBe('골 비중 높음 · 도움 비중 낮음');
    expect(positionTendency('FW', 'LW')).toBe('골 비중 낮음 · 도움 비중 높음');
    expect(positionTendency('MF', 'CM')).toBe('골 비중 보통 · 도움 비중 보통');
  });
  it('같은 계열은 같은 비중으로 보이고, 고르기 전에는 비운다', () => {
    expect(positionTendency('FW', 'CF')).toBe(positionTendency('FW', 'ST'));
    expect(positionTendency('FW', null)).toBe('');
    expect(positionTendency('GK', 'GK')).toContain('거의 없어요');
    expect(Object.keys(POS)).toContain('GK');
  });
});

describe('후보 비교 한 줄', () => {
  const list = [
    { attrs: attrs({ sho: 70 }) },
    { attrs: attrs({ pac: 72, sho: 60 }) },
    { attrs: attrs({ sho: 60 }) },
  ];
  it('다른 두 후보보다 가장 크게 앞서는 능력치를 말한다', () => {
    expect(candidateEdge('FW', list, 0)).toContain('슈팅');
    expect(candidateEdge('FW', list, 1)).toContain('스피드');
  });
  it('앞서는 능력치가 없으면 그렇다고 말한다', () => {
    expect(candidateEdge('FW', list, 2)).toContain('없어요');
  });
});

describe('새로 고침 뒤 이어 쓰기', () => {
  it('맞는 값은 되살리고 단계도 이어 간다', () => {
    const v = parseCreateDraft({
      C: { pos: 'DF', dpos: 'SW', name: '김선수', number: 7, focus: ['def', 'phy'], trait: 'iron' },
      step: 'trait',
    });
    expect(v?.step).toBe('trait');
    expect(v?.draft).toMatchObject({ pos: 'DF', dpos: 'SW', name: '김선수', number: 7 });
  });
  it('형식이 어긋난 값은 버린다', () => {
    expect(parseCreateDraft(null)).toBeNull();
    expect(parseCreateDraft({ C: { pos: 'XX' } })).toBeNull();
    const v = parseCreateDraft({
      C: { pos: 'FW', dpos: 'SW', focus: ['nope'], trait: 'nope', foot: '손', height: 999 },
      step: 'nope',
    });
    expect(v?.step).toBe('pos');
    expect(v?.draft).toEqual({ pos: 'FW' });
  });
});
