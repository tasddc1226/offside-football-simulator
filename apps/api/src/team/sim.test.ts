import { FORMATIONS, YOUTH_NAME, YOUTH_OVR, type PosGroup } from '@offside/contracts/owner-team';
import { describe, expect, it } from 'vitest';
import {
  buildLineup,
  expectedGoals,
  filledCount,
  lineStrength,
  lineupOvr,
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
    expect(lineup).toHaveLength(11);
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

  it('최고 시점 능력치가 있으면 자리 역할의 실력을 쓰고, 최고 OVR을 넘지 않는다', () => {
    const at = (i: number) =>
      buildLineup(
        '4-3-3',
        Array.from({ length: 11 }, (_, k) => (k === i ? 'c' : null)),
        new Map([['c', cb]]),
      )[i]!;
    expect(at(2)).toMatchObject({ slot: 'CB', rating: 82, fit: 1 }); // 84 → 최고 OVR 82로 자른다
    expect(at(1)).toMatchObject({ slot: 'FB', rating: 78, fit: 0.95 });
    expect(at(5)).toMatchObject({ slot: 'DM', rating: 70 });
    expect(at(9)).toMatchObject({ slot: 'ST', rating: 50 });
    expect(at(0)).toMatchObject({ slot: 'GK', rating: 20 });
  });

  it('같은 실력이면 4-4-2는 공격, 3-5-2는 수비, 4-3-3은 중원이 가장 세다', () => {
    const l433 = lineStrength(fullTeam('A', 75, '4-3-3'));
    const l442 = lineStrength(fullTeam('A', 75, '4-4-2'));
    const l352 = lineStrength(fullTeam('A', 75, '3-5-2'));
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
    const r1 = simulateMatch('mat_seed-1', a, b);
    const r2 = simulateMatch('mat_seed-1', a, b);
    expect(r2).toEqual(r1);
    expect(r1.events).toHaveLength(r1.homeGoals + r1.awayGoals);
    // 시드가 다르면 (여러 판 중 적어도 하나는) 달라진다.
    const others = Array.from({ length: 20 }, (_, i) => simulateMatch(`mat_seed-${i + 2}`, a, b));
    expect(others.some((r) => JSON.stringify(r) !== JSON.stringify(r1))).toBe(true);
  });

  it('골키퍼는 골을 넣지 않고, 이벤트는 분 순서이며 도움은 득점자가 아니다', () => {
    const a = fullTeam('A', 85);
    const b = youthTeam();
    const gkIds = new Set([a[0]!.ref.careerId]);
    for (let i = 0; i < 300; i++) {
      const r = simulateMatch(`mat_${i}`, i % 2 ? a : b, i % 2 ? b : a);
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
    const opp = lineStrength(fullTeam('B', 70));
    let prevFor = 0;
    let prevAgainst = Infinity;
    for (const peak of [55, 65, 75, 85, 95]) {
      const me = lineStrength(fullTeam('A', peak));
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
      const r = simulateMatch(`mat_${i}`, weak, strong);
      diff += r.awayGoals - r.homeGoals;
      if (r.awayGoals > r.homeGoals) wins++;
    }
    expect(diff / N).toBeGreaterThan(2);
    expect(wins / N).toBeGreaterThan(0.8);
    // 같은 팀끼리는 홈이 조금 앞선다(대략 비긴다).
    const even = fullTeam('E', 75);
    let homePts = 0;
    for (let i = 0; i < N; i++) {
      const r = simulateMatch(`mat_e${i}`, even, even);
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
    const r = simulateMatch('mat_one', lineup, youthTeam());
    expect(r.homeGoals).toBeGreaterThanOrEqual(0);
    expect(r.homeGoals).toBeLessThanOrEqual(9);
  });
});
