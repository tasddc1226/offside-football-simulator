import { describe, expect, it } from 'vitest';
import { newGame } from './engine.js';
import { ovr, faceOf, notePeakProfile, peakProfileOf } from './attributes.js';
import { ATTR_KEYS } from './data.js';
import { createRng, setActiveRng } from './rng.js';
import type { Pos } from './data.js';

const positions: Pos[] = ['FW', 'MF', 'DF', 'GK'];
const typeByPos: Record<Pos, string> = { FW: 'poacher', MF: 'maker', DF: 'stopper', GK: 'shot' };

describe('능력치 불변식', () => {
  for (const pos of positions) {
    it(`${pos}: OVR은 항상 1..99 범위`, () => {
      setActiveRng(createRng(1000 + pos.charCodeAt(0)));
      const g = newGame(
        { name: '테스트', number: 1, pos, foot: '오른발', type: typeByPos[pos], trait: 'normal' },
        1,
      );
      const o = ovr(g);
      expect(o).toBeGreaterThanOrEqual(1);
      expect(o).toBeLessThanOrEqual(99);
    });

    it(`${pos}: 카드 능력치(attrs)는 세부 능력치(sub)의 가중 평균과 일치한다`, () => {
      setActiveRng(createRng(2000 + pos.charCodeAt(0)));
      const g = newGame(
        { name: '테스트', number: 1, pos, foot: '오른발', type: typeByPos[pos], trait: 'normal' },
        1,
      );
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
      const g = newGame(
        { name: '테스트', number: 1, pos, foot: '오른발', type: typeByPos[pos], trait: 'normal' },
        1,
      );
      for (const v of Object.values(g.sub)) {
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(99);
      }
    });
  }
});

describe('SUB_KEYS 순서 (T-11-048)', () => {
  // 서버의 시즌 성장 기록(growth_json s0·s1)은 SUB_KEYS 순서의 배열이다. 키는 맨 뒤에만 더하고, 순서를 바꾸거나
  // 키를 빼면 이미 쌓인 기록의 해석이 어긋난다 — 그때는 SeasonGrowth.v를 올리고 이 목록을 함께 고친다.
  it('대표 능력치 6개 순서가 고정되어 있다 (growth a0·a1)', async () => {
    const { ATTR_KEYS } = await import('./data.js');
    expect(ATTR_KEYS).toEqual(['pac', 'sho', 'pas', 'dri', 'def', 'phy']);
  });

  it('세부 능력치 키 순서가 고정되어 있다', async () => {
    const { SUB_KEYS } = await import('./attributes.js');
    expect(SUB_KEYS).toEqual([
      'acc',
      'spr',
      'pos',
      'fin',
      'pow',
      'lng',
      'vol',
      'pen',
      'vis',
      'cro',
      'fk',
      'spa',
      'lpa',
      'cur',
      'agi',
      'bal',
      'rea',
      'bc',
      'drb',
      'com',
      'int',
      'hea',
      'awa',
      'stt',
      'sli',
      'jmp',
      'stm',
      'str',
      'agg',
      'div',
      'han',
      'kic',
      'gkp',
      'ref',
    ]);
  });
});

describe('최고 시점 능력치 (T-11-630)', () => {
  const start = () => {
    setActiveRng(createRng(1630));
    const g = newGame(
      { name: '테스트', number: 1, pos: 'MF', foot: '오른발', type: 'maker', trait: 'normal' },
      1630,
    );
    g.peak = 80;
    g.peakProfile = peakProfileOf(g);
    return { g, before: g.peakProfile };
  };

  it('같은 OVR을 다시 찍어도 능력치 합이 그대로거나 낮으면 전성기 값을 지킨다', () => {
    const { g, before } = start();
    g.attrs.pac -= 8;
    g.attrs.sho += 3;
    notePeakProfile(g, 80);
    expect(g.peakProfile).toBe(before);
    g.attrs.pas += 5;
    notePeakProfile(g, 80);
    expect(g.peakProfile).toBe(before);
  });

  it('같은 OVR에서 능력치 합이 오르면 바꾼다', () => {
    const { g, before } = start();
    g.attrs.pas += 3;
    notePeakProfile(g, 80);
    expect(g.peakProfile).not.toBe(before);
    expect(g.peakProfile!.attrs.pas).toBe(before.attrs.pas + 3);
  });

  it('최고 OVR을 넘으면 능력치 합이 낮아도 바꾸고, 못 미치면 두지 않는다', () => {
    const { g, before } = start();
    g.attrs.pac -= 8;
    notePeakProfile(g, 79);
    expect(g.peakProfile).toBe(before);
    notePeakProfile(g, 81);
    expect(g.peakProfile!.attrs.pac).toBe(before.attrs.pac - 8);
  });

  it('값이 없는 옛 저장본은 같은 OVR에서 새로 남긴다', () => {
    const { g } = start();
    delete g.peakProfile;
    notePeakProfile(g, 80);
    expect(g.peakProfile).toEqual(peakProfileOf(g));
  });
});
