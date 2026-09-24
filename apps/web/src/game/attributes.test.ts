import { describe, expect, it } from 'vitest';
import { newGame } from './engine.js';
import { ovr, faceOf } from './attributes.js';
import { ATTR_KEYS } from './data.js';
import { createRng, setActiveRng } from './rng.js';
import type { Pos } from './data.js';

const positions: Pos[] = ['FW', 'MF', 'DF', 'GK'];
const typeByPos: Record<Pos, string> = { FW: 'poacher', MF: 'maker', DF: 'stopper', GK: 'shot' };

describe('능력치 불변식', () => {
  for (const pos of positions) {
    it(`${pos}: OVR은 항상 1..99 범위`, () => {
      setActiveRng(createRng(1000 + pos.charCodeAt(0)));
      const g = newGame({ name: '테스트', number: 1, pos, foot: '오른발', type: typeByPos[pos], trait: 'normal' }, 1);
      const o = ovr(g);
      expect(o).toBeGreaterThanOrEqual(1);
      expect(o).toBeLessThanOrEqual(99);
    });

    it(`${pos}: 카드 능력치(attrs)는 세부 능력치(sub)의 가중 평균과 일치한다`, () => {
      setActiveRng(createRng(2000 + pos.charCodeAt(0)));
      const g = newGame({ name: '테스트', number: 1, pos, foot: '오른발', type: typeByPos[pos], trait: 'normal' }, 1);
      const F = faceOf(g);
      for (const group of ATTR_KEYS) {
        let expected = 0;
        for (const [k, w] of Object.entries(F[group]!)) expected += (g.sub[k] ?? 0) * w;
        expected = Math.round(expected * 10) / 10;
        expect(g.attrs[group]).toBeCloseTo(expected, 1);
      }
    });

    it(`${pos}: 모든 세부 능력치는 1..99 범위`, () => {
      setActiveRng(createRng(3000 + pos.charCodeAt(0)));
      const g = newGame({ name: '테스트', number: 1, pos, foot: '오른발', type: typeByPos[pos], trait: 'normal' }, 1);
      for (const v of Object.values(g.sub)) {
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(99);
      }
    });
  }
});
