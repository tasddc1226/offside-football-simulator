import { describe, expect, it } from 'vitest';
import { generateCandidates } from './candidates.js';
import { DETAILS_OF, DPOS, scoreRate, type DetailPos, type Pos } from './data.js';
import { newGame } from './engine.js';
import { mainRole, ovr } from './attributes.js';
import { legendScore, retire, legendSnapshot } from './season.js';
import { createRng, setActiveRng } from './rng.js';
import { startOvr } from '../ui/create-view.js';

const make = (pos: Pos, dpos?: DetailPos, attrs?: Parameters<typeof newGame>[2]) => {
  setActiveRng(createRng(11));
  return newGame(
    {
      name: '테스트',
      number: 7,
      pos,
      dpos,
      foot: '오른발',
      focus: dpos ? DPOS[dpos].focus : ['sho', 'dri'],
      trait: 'late',
    },
    11,
    attrs,
  );
};

describe('세부 포지션 (T-10-091)', () => {
  it('세부 포지션이 역할(OVR 가중)을 정하고 저장본에 남는다', () => {
    for (const d of Object.keys(DPOS) as DetailPos[]) {
      const pos = (Object.keys(DETAILS_OF) as Pos[]).find((p) => DETAILS_OF[p].includes(d))!;
      const s = make(pos, d);
      expect(s.dpos).toBe(d);
      expect(mainRole(s)).toBe(DPOS[d].role);
      expect(legendSnapshot(s).dpos).toBe(d);
    }
  });

  it('세부 포지션이 없으면 옛 방식 그대로다(프리시즌 선수)', () => {
    const s = make('MF');
    expect('dpos' in s).toBe(false);
    expect(scoreRate(s)).toEqual({ goal: 0.14, assist: 0.19 });
  });

  it('후보 카드의 시작 OVR은 세부 포지션에서도 실제 시작 OVR과 1 이내다', () => {
    for (const [pos, ds] of Object.entries(DETAILS_OF) as [Pos, DetailPos[]][])
      for (const d of ds)
        for (const cand of generateCandidates(pos, DPOS[d].focus, d)) {
          const s = make(pos, d, cand.attrs);
          expect(Math.abs(ovr(s) - startOvr(pos, cand.attrs))).toBeLessThanOrEqual(1);
        }
  });

  it('윙어는 스트라이커보다 도움 기대값이 크고 골 기대값이 작다', () => {
    const st = scoreRate({ pos: 'FW', dpos: 'ST' }),
      w = scoreRate({ pos: 'FW', dpos: 'W' });
    expect(w.assist).toBeGreaterThan(st.assist);
    expect(w.goal).toBeLessThan(st.goal);
  });

  it('은퇴 기록·레전드 점수가 세부 포지션을 쓴다', () => {
    const s = make('FW', 'W');
    s.career.push({
      year: 2026,
      age: 18,
      club: 'x',
      league: 'x',
      apps: 30,
      goals: 10,
      assists: 20,
      rating: 7,
      rank: 1,
      ovr: 60,
      honors: [],
      mil: false,
    } as never);
    const plain = { ...s, dpos: undefined };
    expect(legendScore(s)).toBeGreaterThan(legendScore(plain));
    expect(retire(s).dpos).toBe('W');
  });

  it('T-10-092 최고 시점 능력치: 주 포지션 자리 실력 = 최고 OVR, 은퇴 기록에 실린다', () => {
    const s = make('DF', 'CB');
    expect(s.peakProfile!.roles.CB).toBe(s.peak);
    expect(s.peakProfile!.roles.CB).toBeGreaterThan(s.peakProfile!.roles.ST);
    expect(Object.keys(s.peakProfile!.attrs)).toEqual(['pac', 'sho', 'pas', 'dri', 'def', 'phy']);
    expect(retire(s).profile).toEqual(s.peakProfile);
  });

  it('T-10-092 최고 시점 능력치가 없는 옛 저장본은 은퇴 때 최고 OVR 높이로 추정한다', () => {
    const s = make('FW', 'ST');
    delete s.peakProfile;
    s.peak = ovr(s) + 6;
    const p = retire(s).profile!;
    expect(p.roles.ST).toBe(s.peak);
  });
});
