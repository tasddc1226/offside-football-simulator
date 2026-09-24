import { describe, expect, it } from 'vitest';
import { generateCandidates } from './candidates.js';
import { newGame } from './engine.js';
import { createRng, getActiveRng, setActiveRng } from './rng.js';
import { ATTR_KEYS } from './data.js';

describe('generateCandidates', () => {
  it('세 후보는 능력치 총합이 모두 같다(분포만 다르다)', () => {
    const cands = generateCandidates('FW', 'poacher');
    expect(cands).toHaveLength(3);
    const totals = cands.map((c) => c.total);
    expect(totals[0]).toBe(totals[1]);
    expect(totals[1]).toBe(totals[2]);
  });

  it('각 능력치는 20~70 범위를 유지한다', () => {
    const cands = generateCandidates('GK', 'wall');
    for (const c of cands) for (const k of ATTR_KEYS) {
      expect(c.attrs[k]).toBeGreaterThanOrEqual(20);
      expect(c.attrs[k]).toBeLessThanOrEqual(70);
    }
  });

  it('메인 게임 RNG(시드) 상태를 전혀 소비하지 않는다', () => {
    setActiveRng(createRng(11));
    const before = getActiveRng().getState();
    generateCandidates('DF', 'stopper');
    const after = getActiveRng().getState();
    expect(after).toEqual(before);
  });

  it('newGame()에 presetAttrs 없이 호출하면 기존 RNG 소비 동작이 그대로다(패리티 보존)', () => {
    setActiveRng(createRng(5));
    const a = newGame({ name: 'a', number: 1, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late' }, 5);
    setActiveRng(createRng(5));
    const b = newGame({ name: 'a', number: 1, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late' }, 5);
    expect(a.attrs).toEqual(b.attrs);
    expect(a.rng).toEqual(b.rng);
  });

  it('presetAttrs를 넘기면 능력치 분포가 preset을 따라간다(세부 능력치 파생 후 syncFace로 재계산되므로 완전히 동일하진 않지만, 몰아준 지표가 확실히 앞선다)', () => {
    setActiveRng(createRng(5));
    const shoHeavy = newGame(
      { name: 'a', number: 1, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late' },
      5,
      { pac: 25, sho: 70, pas: 25, dri: 25, def: 25, phy: 25 },
    );
    setActiveRng(createRng(5));
    const defHeavy = newGame(
      { name: 'a', number: 1, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late' },
      5,
      { pac: 25, sho: 25, pas: 25, dri: 25, def: 70, phy: 25 },
    );
    expect(shoHeavy.attrs.sho).toBeGreaterThan(defHeavy.attrs.sho);
    expect(defHeavy.attrs.def).toBeGreaterThan(shoHeavy.attrs.def);
  });
});
