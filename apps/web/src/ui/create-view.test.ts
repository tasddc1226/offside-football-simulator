import { describe, expect, it } from 'vitest';
import { generateCandidates } from '../game/candidates.js';
import { defaultFocus, type Pos } from '../game/data.js';
import { newGame } from '../game/engine.js';
import { ovr } from '../game/attributes.js';
import { createRng, setActiveRng } from '../game/rng.js';
import { hexPoints, hiddenStrength, iGa, radarOrder, scoutLine, startOvr } from './create-view.js';

describe('선수 생성 표시 로직', () => {
  it('받침에 따라 이/가를 고른다', () => {
    expect(iGa('슈팅')).toBe('이');
    expect(iGa('스피드')).toBe('가');
    expect(iGa('반사 신경')).toBe('이');
  });

  it('스카우트 코멘트는 가장 높은 능력치로 유형을 정한다', () => {
    expect(scoutLine('FW', { pac: 50, sho: 60, pas: 42, dri: 48, def: 28, phy: 46 })).toBe('슈팅이 특출난 골잡이');
    expect(scoutLine('MF', { pac: 46, sho: 42, pas: 55, dri: 54, def: 40, phy: 44 })).toBe('패스·드리블이 고루 좋은 플레이메이커');
    expect(scoutLine('GK', { pac: 48, sho: 30, pas: 38, dri: 40, def: 60, phy: 48 })).toBe('다이빙이 특출난 슈퍼 세이버');
  });

  it('후보 카드의 시작 OVR은 실제 시작 OVR과 1 이내로 맞는다', () => {
    for (const pos of ['FW', 'MF', 'DF', 'GK'] as Pos[]) {
      for (const cand of generateCandidates(pos, defaultFocus(pos))) {
        setActiveRng(createRng(7));
        const g = newGame({ name: '테스트', number: 9, pos, foot: '오른발', focus: defaultFocus(pos), trait: 'late' }, 7, cand.attrs);
        expect(Math.abs(ovr(g) - startOvr(pos, cand.attrs))).toBeLessThanOrEqual(1);
      }
    }
  });

  it('숨은 무기는 주력을 뺀 가장 높은 능력치다', () => {
    expect(hiddenStrength({ pac: 56, sho: 58, pas: 39, dri: 48, def: 24, phy: 49 }, ['sho', 'pac'])).toBe('phy');
  });

  it('미니 레이더는 꼭짓점 6개를 만든다', () => {
    const pts = hexPoints(radarOrder('FW').map(() => 100), 10).split(' ');
    expect(pts).toHaveLength(6);
    expect(pts[0]).toBe('10.0,0.0');
  });
});
