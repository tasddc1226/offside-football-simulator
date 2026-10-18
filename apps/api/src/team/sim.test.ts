import { createHash } from 'node:crypto';
import {
  FORMATIONS,
  REPORT_LINE_WEIGHT,
  YOUTH_NAME,
  YOUTH_OVR,
  type PosGroup,
} from '@offside/contracts/owner-team';
import { describe, expect, it } from 'vitest';
import {
  buildLineup,
  expectedGoals,
  filledCount,
  lineupLines,
  lineupOvr,
  lineupSynergy,
  SIM,
  simulateMatch,
  type LineupCareer,
} from './sim.js';

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

/** 포메이션 자리에 딱 맞는 계열의 선수 11명(최고 OVR = peak). */
function fullTeam(prefix: string, peak: number, formation: keyof typeof FORMATIONS = '4-3-3') {
  const careers = FORMATIONS[formation].map((slot, i): LineupCareer => ({
    id: `${prefix}-${i}`,
    pos: GROUP_OF_SLOT[slot]!,
    dpos: null,
    peak,
    roles: null,
    number: i + 1,
    publicName: i === 9 ? `${prefix} 스트라이커` : null,
  }));
  const map = new Map(careers.map((c) => [c.id, c]));
  return buildLineup(
    formation,
    careers.map((c) => c.id),
    map,
  );
}

const youthTeam = () => buildLineup('4-4-2', Array(11).fill(null), new Map());

describe('buildLineup', () => {
  it('빈 자리·자격 없는 커리어는 유스 선수로 채운다', () => {
    const star: LineupCareer = {
      id: 'a',
      pos: 'FW',
      dpos: null,
      peak: 90,
      roles: null,
      number: 9,
      publicName: null,
    };
    const lineup = buildLineup(
      '4-3-3',
      [null, null, null, null, null, null, null, null, null, 'a', 'stranger'],
      new Map([['a', star]]),
    );
    expect(filledCount(lineup)).toBe(1);
    expect(lineup[9]).toMatchObject({ slot: 'ST', careerId: 'a', rating: 86, fit: 0.95 });
    expect(lineup[9]!.ref.anon).toBe('익명의 공격수 No.9');
    expect(lineup[10]).toMatchObject({ careerId: null, rating: YOUTH_OVR });
    expect(lineup[10]!.ref.anon).toBe(YOUTH_NAME);
    expect(lineupOvr(lineup)).toBe(Math.round((86 + 10 * YOUTH_OVR) / 11));
  });

  it('포지션이 안 맞으면 실력이 깎인다(골키퍼를 공격수 자리에 → 0.3)', () => {
    const gk: LineupCareer = {
      id: 'g',
      pos: 'GK',
      dpos: null,
      peak: 90,
      roles: null,
      number: 1,
      publicName: null,
    };
    const lineup = buildLineup('4-3-3', [...Array(9).fill(null), 'g', null], new Map([['g', gk]]));
    expect(lineup[9]!.rating).toBe(27);
  });
});

describe('T-10-092 자리별 실력·포메이션', () => {
  const ROLES = { GK: 20, CB: 84, FB: 78, DM: 70, CM: 62, AM: 55, W: 52, ST: 50 } as const;
  const cb: LineupCareer = {
    id: 'c',
    pos: 'DF',
    dpos: 'CB',
    peak: 82,
    roles: ROLES,
    number: 4,
    publicName: null,
  };

  it('최고 시점 능력치가 있으면 자리 역할의 실력을 쓰고, 최고 OVR + 2를 넘지 않는다(T-11-197)', () => {
    const at = (i: number) =>
      buildLineup(
        '4-3-3',
        Array.from({ length: 11 }, (_, k) => (k === i ? 'c' : null)),
        new Map([['c', cb]]),
      )[i]!;
    expect(at(2)).toMatchObject({ slot: 'CB', rating: 84, fit: 1.02 }); // 최고 OVR 82 + 2까지
    expect(at(1)).toMatchObject({ slot: 'FB', rating: 78, fit: 0.95 });
    expect(at(5)).toMatchObject({ slot: 'DM', rating: 70 });
    expect(at(9)).toMatchObject({ slot: 'ST', rating: 50 });
    expect(at(0)).toMatchObject({ slot: 'GK', rating: 20 });
  });

  it('같은 실력이면 4-4-2는 공격, 3-5-2는 수비, 4-3-3은 중원이 가장 세다', () => {
    const l433 = lineupLines(fullTeam('A', 75, '4-3-3'));
    const l442 = lineupLines(fullTeam('A', 75, '4-4-2'));
    const l352 = lineupLines(fullTeam('A', 75, '3-5-2'));
    expect(l442.atk).toBeGreaterThan(l433.atk);
    expect(l433.atk).toBeGreaterThan(l352.atk);
    expect(l352.def).toBeGreaterThan(l433.def);
    expect(l433.def).toBeGreaterThan(l442.def);
    expect(l433.mid).toBeGreaterThan(l442.mid);
    expect(l433.mid).toBeGreaterThan(l352.mid);
  });
});

describe('simulateMatch', () => {
  it('같은 시드·같은 선발이면 결과가 같다', () => {
    const a = fullTeam('A', 80);
    const b = fullTeam('B', 75, '3-5-2');
    const r1 = simulateMatch('mat_seed-1', a, b, 1);
    const r2 = simulateMatch('mat_seed-1', a, b, 1);
    expect(r2).toEqual(r1);
    expect(r1.events).toHaveLength(r1.homeGoals + r1.awayGoals);
    // 시드가 다르면 (여러 판 중 적어도 하나는) 달라진다.
    const others = Array.from({ length: 20 }, (_, i) =>
      simulateMatch(`mat_seed-${i + 2}`, a, b, 1),
    );
    expect(others.some((r) => JSON.stringify(r) !== JSON.stringify(r1))).toBe(true);
  });

  it('골키퍼는 골을 넣지 않고, 이벤트는 분 순서이며 도움은 득점자가 아니다', () => {
    const a = fullTeam('A', 85);
    const b = youthTeam();
    const gkIds = new Set([a[0]!.ref.careerId]);
    for (let i = 0; i < 300; i++) {
      const r = simulateMatch(`mat_${i}`, i % 2 ? a : b, i % 2 ? b : a, 1);
      for (const [k, e] of r.events.entries()) {
        expect(e.slot).not.toBe('GK');
        expect(gkIds.has(e.scorer.careerId)).toBe(false);
        expect(e.scorer.anon).not.toContain('골키퍼');
        expect(e.minute).toBeGreaterThanOrEqual(1);
        expect(e.minute).toBeLessThanOrEqual(90);
        if (k > 0) expect(e.minute).toBeGreaterThanOrEqual(r.events[k - 1]!.minute);
        if (e.assist && e.scorer.careerId) expect(e.assist.careerId).not.toBe(e.scorer.careerId);
      }
    }
  });

  it('실력이 오를수록 기대 득점이 오르고 상대 기대 득점은 내려간다', () => {
    const opp = lineupLines(fullTeam('B', 70));
    let prevFor = 0;
    let prevAgainst = Infinity;
    for (const peak of [55, 65, 75, 85, 95]) {
      const me = lineupLines(fullTeam('A', peak));
      const forXg = expectedGoals(me, opp, true);
      const againstXg = expectedGoals(opp, me, false);
      expect(forXg).toBeGreaterThanOrEqual(prevFor);
      expect(againstXg).toBeLessThanOrEqual(prevAgainst);
      prevFor = forXg;
      prevAgainst = againstXg;
    }
  });

  it('강팀이 약팀을 여러 판 평균으로 이긴다(홈 이점은 작다)', () => {
    const strong = fullTeam('S', 88);
    const weak = youthTeam();
    let diff = 0;
    let wins = 0;
    const N = 400;
    for (let i = 0; i < N; i++) {
      const r = simulateMatch(`mat_${i}`, weak, strong, 1);
      diff += r.awayGoals - r.homeGoals;
      if (r.awayGoals > r.homeGoals) wins++;
    }
    expect(diff / N).toBeGreaterThan(2);
    expect(wins / N).toBeGreaterThan(0.8);
    // 같은 팀끼리는 홈이 조금 앞선다(대략 비긴다).
    const even = fullTeam('E', 75);
    let homePts = 0;
    for (let i = 0; i < N; i++) {
      const r = simulateMatch(`mat_e${i}`, even, even, 1);
      homePts += r.homeGoals - r.awayGoals;
    }
    expect(Math.abs(homePts / N)).toBeLessThan(0.5);
  });

  it('유스로 채운 팀도 경기할 수 있다(선수 1명)', () => {
    const one: LineupCareer = {
      id: 'x',
      pos: 'MF',
      dpos: null,
      peak: 70,
      roles: null,
      number: 8,
      publicName: null,
    };
    const lineup = buildLineup(
      '4-4-2',
      [null, null, null, null, null, null, 'x'],
      new Map([['x', one]]),
    );
    const r = simulateMatch('mat_one', lineup, youthTeam(), 1);
    expect(r.homeGoals).toBeGreaterThanOrEqual(0);
    expect(r.homeGoals).toBeLessThanOrEqual(9);
  });
});

describe('T-11-105 시너지', () => {
  /** 4-3-3: 타깃맨 ST + 윙어(오른발, 왼쪽) — 크로스 공식·주발 맞춤이 켜지는 팀. */
  function synergyTeam(prefix: string) {
    const types = [
      'shot',
      'fullback',
      'stopper',
      'stopper',
      'fullback',
      'b2b',
      'maker',
      'maker',
      'winger',
      'target',
      'winger',
    ];
    const careers = FORMATIONS['4-3-3'].map((slot, i): LineupCareer => ({
      id: `${prefix}-${i}`,
      pos: GROUP_OF_SLOT[slot]!,
      dpos: null,
      peak: 75,
      roles: null,
      number: i + 1,
      publicName: null,
      type: types[i]!,
      foot: '오른발',
      nation: 'KR',
      raised: true,
    }));
    return buildLineup(
      '4-3-3',
      careers.map((c) => c.id),
      new Map(careers.map((c) => [c.id, c])),
    );
  }

  it('시너지를 끄면 유형·주발이 있어도 지금과 같은 결과다', () => {
    const plain = fullTeam('A', 75);
    const syn = synergyTeam('A');
    const opp = fullTeam('B', 75);
    for (let i = 0; i < 30; i++) {
      const a = simulateMatch(`mat_s${i}`, plain, opp, 0);
      const b = simulateMatch(`mat_s${i}`, syn, opp, 0);
      expect([b.homeGoals, b.awayGoals]).toEqual([a.homeGoals, a.awayGoals]);
      expect(b.synergy).toBeUndefined();
    }
  });

  it('시너지를 켜면 켜진 시너지를 결과에 남기고 줄 힘이 오른다', () => {
    const syn = synergyTeam('A');
    const r = simulateMatch('mat_on', syn, fullTeam('B', 75), 1);
    expect(r.synergy?.home).toEqual(
      expect.arrayContaining(['cross', 'engine', 'homegrown', 'national']),
    );
    // T-11-225 국적이 비면 기본 국적이라 같은 국적 11명 — 국가대표 라인업만 켜진다.
    expect(r.synergy?.away).toEqual(['national']);
    expect(lineupLines(syn, lineupSynergy(syn)).atk).toBeGreaterThan(lineupLines(syn).atk);
  });

  it('유스 선수 자리는 시너지에 들지 않는다', () => {
    expect(youthTeam().every((s) => s.syn === null)).toBe(true);
  });
});

// T-11-310 감독 칸 보정. 같은 전력이면 가장 센 감독이라도 승률을 5%p 넘게 올리지 않고, 감독이 없으면 결과가 그대로다.
describe('감독 보정', () => {
  const poissonP = (l: number, k: number) => {
    let p = Math.exp(-l);
    for (let i = 1; i <= k; i++) p *= l / i;
    return p;
  };
  /** 기대 득점 두 개로 본 홈 승리 확률(9골까지). */
  const winP = (h: number, a: number) => {
    let w = 0;
    for (let i = 0; i <= 9; i++) for (let j = 0; j < i; j++) w += poissonP(h, i) * poissonP(a, j);
    return w;
  };
  const best = {
    card: {
      mastery: { '4-3-3': 'S', '4-4-2': 'S', '3-5-2': 'S' } as const,
      style: 'attack' as const,
      specials: ['wing', 'counter'] as const,
    },
    formation: '4-3-3' as const,
  };

  it('감독이 없으면 지금과 같은 결과다', () => {
    const home = fullTeam('h', 80);
    const away = fullTeam('a', 80);
    expect(simulateMatch('m1', home, away, 1, { coaches: { home: null, away: null } })).toEqual(
      simulateMatch('m1', home, away, 1),
    );
  });

  it('가장 센 감독도 같은 전력 승률을 5%p 안쪽으로만 올린다', async () => {
    const { managerLines, addLines } = await import('@offside/contracts/manager-rules');
    const team = fullTeam('h', 80);
    const base = lineupLines(team);
    // 특기 대상 시너지가 모두 켜진 경우(가장 큰 보정).
    const boosted = addLines(
      base,
      managerLines(best.card, best.formation, ['cross', 'overlap', 'counter', 'killpass']),
    );
    const before = winP(expectedGoals(base, base, false), expectedGoals(base, base, false));
    const after = winP(expectedGoals(boosted, base, false), expectedGoals(base, boosted, false));
    expect(after).toBeGreaterThan(before);
    expect(after - before).toBeLessThanOrEqual(0.05);
  });
});

describe('T-11-379 경기 리포트', () => {
  const varied = (p: string, peak: number, f: keyof typeof FORMATIONS) => {
    const cs = FORMATIONS[f].map((slot, i): LineupCareer => ({
      id: `${p}-${i}`,
      pos: GROUP_OF_SLOT[slot]!,
      dpos: null,
      peak: peak + (i % 4),
      roles: null,
      number: i + 1,
      publicName: null,
    }));
    return buildLineup(
      f,
      cs.map((c) => c.id),
      new Map(cs.map((c) => [c.id, c])),
    );
  };

  it('리포트를 더해도 같은 시드의 골 · 이벤트는 기능 전과 같다(난수를 더 쓰지 않는다)', () => {
    const h = createHash('sha256');
    for (let i = 0; i < 400; i++) {
      const r = simulateMatch(
        `m${i}`,
        varied('a', 70 + (i % 15), '4-3-3'),
        varied('b', 72, i % 2 ? '4-4-2' : '3-5-2'),
        i % 3,
        { neutral: i % 5 === 0 },
      );
      h.update(JSON.stringify([r.homeGoals, r.awayGoals, r.events, r.synergy ?? null]));
    }
    // 기능 전 코드로 같은 400판을 돌려 얻은 값.
    expect(h.digest('hex')).toBe(
      'e53c8404ce188a9a51ffbc2e549d9431d77f7af23417964d5087b8366297c1e3',
    );
  });

  it('리포트의 기대 득점은 골을 뽑은 기대 득점, 줄 힘은 경기에 쓴 줄 힘이다', () => {
    const home = varied('a', 80, '4-3-3');
    const away = varied('b', 74, '4-4-2');
    const r = simulateMatch('rep', home, away, 0);
    const hl = lineupLines(home);
    const al = lineupLines(away);
    expect(r.report.home.lines).toEqual(hl);
    expect(r.report.away.lines).toEqual(al);
    expect(r.report.home.xg).toBe(expectedGoals(hl, al, true));
    expect(r.report.away.xg).toBe(expectedGoals(al, hl, false));
  });

  it('리포트의 줄 무게는 기대 득점 식의 무게와 같다', () => {
    expect(REPORT_LINE_WEIGHT).toEqual({ atk: SIM.atkK, mid: 2 * SIM.midK, def: SIM.atkK });
  });
});
