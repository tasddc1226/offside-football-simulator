import { FORMATIONS, type PosGroup } from '@offside/contracts/owner-team';
import { MOMENT_RULES, SITUATIONS } from '@offside/contracts/team-moments';
import { describe, expect, it } from 'vitest';
import {
  finishMoments,
  liveDone,
  liveResult,
  resolveMoment,
  startLiveMatch,
  type LiveState,
} from './moments.js';
import { buildLineup, simulateMatch, type LineupCareer } from './sim.js';

const GROUP_OF_SLOT: Record<string, PosGroup> = {
  GK: 'GK',
  CB: 'DF',
  FB: 'DF',
  DM: 'MF',
  CM: 'MF',
  AM: 'MF',
  W: 'FW',
  ST: 'FW',
};
const TYPES: Record<PosGroup, string[]> = {
  FW: ['poacher', 'speed', 'target'],
  MF: ['maker', 'b2b', 'winger'],
  DF: ['stopper', 'fullback', 'libero'],
  GK: ['shot', 'sweeper', 'wall'],
};

function team(prefix: string, peak: number) {
  const careers = FORMATIONS['4-3-3'].map((slot, i): LineupCareer => {
    const pos = GROUP_OF_SLOT[slot]!;
    return {
      id: `${prefix}-${i}`,
      pos,
      dpos: null,
      peak: peak + (i % 3) * 2,
      roles: null,
      number: i + 1,
      publicName: null,
      type: TYPES[pos][i % 3]!,
    };
  });
  return buildLineup(
    '4-3-3',
    careers.map((c) => c.id),
    new Map(careers.map((c) => [c.id, c])),
  );
}

const SEASON = 1;
const home = team('h', 84);
const away = team('a', 82);

function play(n: number, chooser: (s: LiveState) => void) {
  let hg = 0,
    ag = 0,
    w = 0,
    shown = 0;
  for (let i = 0; i < n; i++) {
    const s = startLiveMatch(`m-${i}`, home, away, SEASON);
    shown += s.moments.filter((m) => m.shown).length;
    chooser(s);
    finishMoments(s);
    const r = liveResult(s);
    hg += r.homeGoals;
    ag += r.awayGoals;
    if (r.homeGoals > r.awayGoals) w++;
  }
  return { hg: hg / n, ag: ag / n, win: w / n, shown: shown / n };
}

describe('장면 정의', () => {
  it('장면 id는 겹치지 않고 선택지는 1~3개다', () => {
    expect(new Set(SITUATIONS.map((s) => s.id)).size).toBe(SITUATIONS.length);
    for (const s of SITUATIONS) {
      expect(s.choices.length).toBeGreaterThanOrEqual(1);
      expect(s.choices.length).toBeLessThanOrEqual(3);
      expect(new Set(s.choices.map((c) => c.id)).size).toBe(s.choices.length);
    }
  });
  it('기본 8자리마다 찬스나 위기 장면이 있다', () => {
    for (const r of ['GK', 'CB', 'FB', 'DM', 'CM', 'AM', 'W', 'ST'] as const)
      expect(SITUATIONS.some((s) => s.roles.includes(r))).toBe(true);
  });
});

describe('startLiveMatch', () => {
  it('같은 경기 id면 같은 장면 · 같은 결과다', () => {
    const a = startLiveMatch('mat-x', home, away, SEASON);
    const b = startLiveMatch('mat-x', home, away, SEASON);
    expect(a).toEqual(b);
  });

  it('화면에서 고르는 장면은 최대 3개이고, 넘친 장면은 이미 자동 판정돼 있다', () => {
    for (let i = 0; i < 300; i++) {
      const s = startLiveMatch(`cap-${i}`, home, away, SEASON);
      const shown = s.moments.filter((m) => m.shown);
      expect(shown.length).toBeLessThanOrEqual(MOMENT_RULES.maxShown);
      expect(shown.every((m) => m.picked === undefined)).toBe(true);
      expect(s.moments.filter((m) => !m.shown).every((m) => m.picked === 'auto')).toBe(true);
    }
  });

  it('찬스는 골키퍼가 주인공이 되지 않는다', () => {
    for (let i = 0; i < 200; i++) {
      const s = startLiveMatch(`gk-${i}`, home, away, SEASON);
      for (const m of s.moments) if (m.kind === 'chance') expect(m.actor.slot).not.toBe('GK');
    }
  });

  it('자동 선택이면 골 수 기대값이 장면 없는 경기와 같다', () => {
    const N = 20000;
    const auto = play(N, () => {});
    let hg = 0,
      ag = 0;
    for (let i = 0; i < N; i++) {
      const r = simulateMatch(`m-${i}`, home, away, SEASON);
      hg += r.homeGoals;
      ag += r.awayGoals;
    }
    expect(auto.hg).toBeCloseTo(hg / N, 1);
    expect(auto.ag).toBeCloseTo(ag / N, 1);
    // 경기당 고르는 장면이 1개 이상은 나온다.
    expect(auto.shown).toBeGreaterThan(1.5);
  });

  it('무작위로 골라도 자동 선택과 크게 다르지 않고, 잘 고르면 조금 더 이긴다', () => {
    const N = 20000;
    const auto = play(N, () => {});
    let k = 0;
    const random = play(N, (s) => {
      for (const m of s.moments)
        if (m.shown) resolveMoment(m, m.choices[k++ % m.choices.length]!.id);
    });
    // 기대 득실(골 + 역습)이 가장 좋은 선택.
    const best = play(N, (s) => {
      for (const m of s.moments) {
        if (!m.shown) continue;
        const ev = (c: (typeof m.choices)[number]) =>
          m.kind === 'chance'
            ? c.pct / 100 - (1 - c.pct / 100) * c.risk
            : (c.pct / 100) * c.gain - (1 - c.pct / 100);
        resolveMoment(m, [...m.choices].sort((a, b) => ev(b) - ev(a))[0]!.id);
      }
    });
    expect(Math.abs(random.win - auto.win)).toBeLessThan(0.03);
    expect(best.win - auto.win).toBeGreaterThan(0.03);
    expect(best.win - auto.win).toBeLessThan(0.1);
  });
});

describe('resolveMoment', () => {
  it('한 번 판정한 장면은 다시 보내도 바뀌지 않고, 모르는 선택지는 거절한다', () => {
    const s = startLiveMatch('mat-r', home, away, SEASON);
    const m = s.moments.find((x) => x.shown);
    if (!m) return;
    expect(resolveMoment(m, 'nope')).toBe(false);
    expect(resolveMoment(m, m.choices[0]!.id)).toBe(true);
    const first = structuredClone(m);
    resolveMoment(m, m.choices[1]?.id ?? 'auto');
    expect(m).toEqual(first);
  });

  it('확률이 높은 선택지는 낮은 선택지가 성공한 장면에서 늘 성공한다(판정값은 미리 정해진다)', () => {
    for (let i = 0; i < 200; i++) {
      const s = startLiveMatch(`mono-${i}`, home, away, SEASON);
      for (const m of s.moments.filter((x) => x.shown)) {
        const sorted = [...m.choices].sort((a, b) => a.pct - b.pct);
        const lo = structuredClone(m);
        const hi = structuredClone(m);
        resolveMoment(lo, sorted[0]!.id);
        resolveMoment(hi, sorted.at(-1)!.id);
        if (lo.ok) expect(hi.ok).toBe(true);
      }
    }
  });

  it('모든 장면을 판정하면 끝난다', () => {
    const s = startLiveMatch('mat-d', home, away, SEASON);
    finishMoments(s);
    expect(liveDone(s)).toBe(true);
  });
});
