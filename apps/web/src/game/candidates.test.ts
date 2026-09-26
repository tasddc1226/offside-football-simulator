import { describe, expect, it } from 'vitest';
import { generateCandidates } from './candidates.js';
import { newGame } from './engine.js';
import { createRng, getActiveRng, setActiveRng } from './rng.js';
import { ATTR_KEYS, focusMod, focusOfType, typeForFocus, TYPES } from './data.js';
import { applyTraining, focusOf } from './engine.js';

describe('generateCandidates', () => {
  it('세 후보는 능력치 총합이 모두 같다(분포만 다르다)', () => {
    const cands = generateCandidates('FW', ['sho', 'pac']);
    expect(cands).toHaveLength(3);
    const totals = cands.map((c) => c.total);
    expect(totals[0]).toBe(totals[1]);
    expect(totals[1]).toBe(totals[2]);
  });

  it('각 능력치는 20~70 범위를 유지한다', () => {
    const cands = generateCandidates('GK', ['phy', 'def']);
    for (const c of cands)
      for (const k of ATTR_KEYS) {
        expect(c.attrs[k]).toBeGreaterThanOrEqual(20);
        expect(c.attrs[k]).toBeLessThanOrEqual(70);
      }
  });

  it('메인 게임 RNG(시드) 상태를 전혀 소비하지 않는다', () => {
    setActiveRng(createRng(11));
    const before = getActiveRng().getState();
    generateCandidates('DF', ['def', 'phy']);
    const after = getActiveRng().getState();
    expect(after).toEqual(before);
  });

  it('newGame()에 presetAttrs 없이 호출하면 기존 RNG 소비 동작이 그대로다(패리티 보존)', () => {
    setActiveRng(createRng(5));
    const a = newGame(
      { name: 'a', number: 1, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late' },
      5,
    );
    setActiveRng(createRng(5));
    const b = newGame(
      { name: 'a', number: 1, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late' },
      5,
    );
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

  it('주력 능력치는 모든 후보에서 기준선 아래로 내려가지 않는다(T-10-008)', () => {
    for (let n = 0; n < 20; n++) {
      const [base, ...rest] = generateCandidates('MF', ['dri', 'sho']);
      for (const c of rest) {
        expect(c.attrs.dri).toBeGreaterThanOrEqual(base!.attrs.dri);
        expect(c.attrs.sho).toBeGreaterThanOrEqual(base!.attrs.sho);
      }
    }
  });
});

describe('주력 능력치 (T-10-008)', () => {
  it('focusMod는 주력 두 개를 올리고 비주력 두 개를 내린다(순합 +5)', () => {
    const mod = focusMod('FW', ['sho', 'pac']);
    expect(mod.sho).toBeGreaterThan(0);
    expect(mod.pac).toBeGreaterThan(0);
    expect(Object.values(mod).filter((v) => v! < 0)).toHaveLength(2);
    expect(Object.values(mod).reduce((a, b) => a! + b!, 0)).toBe(5);
    expect(mod.def).toBeLessThan(0); // 공격수에서 OVR 가중치가 가장 낮은 능력치
  });

  it('유형 ↔ 주력 변환이 서로 맞물린다', () => {
    for (const pos of ['FW', 'MF', 'DF', 'GK'] as const)
      for (const t of TYPES[pos]) expect(typeForFocus(pos, focusOfType(pos, t.id))).toBe(t.id);
  });

  it('newGame에 focus를 넘기면 저장되고 type은 가장 가까운 유형으로 파생된다', () => {
    setActiveRng(createRng(3));
    const s = newGame(
      { name: 'a', number: 1, pos: 'DF', foot: '오른발', focus: ['pac', 'pas'], trait: 'late' },
      3,
    );
    expect(s.focus).toEqual(['pac', 'pas']);
    expect(s.type).toBe('fullback');
  });

  it('옛 저장본(focus 없음)은 유형에서 주력을 구한다', () => {
    setActiveRng(createRng(3));
    const s = newGame(
      { name: 'a', number: 1, pos: 'FW', foot: '오른발', type: 'target', trait: 'late' },
      3,
    );
    delete s.focus;
    expect(focusOf(s)).toEqual(['phy', 'sho']);
  });

  it('주력 훈련이 같은 조건의 비주력 훈련보다 더 많이 오른다', () => {
    const gain = (k: 'sho' | 'pas') => {
      setActiveRng(createRng(9));
      const s = newGame(
        { name: 'a', number: 1, pos: 'FW', foot: '오른발', focus: ['sho', 'pac'], trait: 'late' },
        9,
        { pac: 50, sho: 50, pas: 50, dri: 50, def: 30, phy: 45 },
      );
      s.cond = 100;
      setActiveRng(createRng(21));
      const before = s.attrs[k];
      s.training = k;
      applyTraining(s);
      return s.attrs[k] - before;
    };
    expect(gain('sho')).toBeGreaterThan(gain('pas'));
  });
});
