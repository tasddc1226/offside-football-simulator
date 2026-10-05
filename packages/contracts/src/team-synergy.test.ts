import { describe, expect, it } from 'vitest';
import { FORMATIONS, lineStrength, presetLayout } from './owner-team.js';
import {
  DUOS,
  DUO_LINE_CAP,
  DUO_TOTAL_CAP,
  HOMEGROWN_MIN,
  NATIONAL_MIN,
  SYNERGY_FROM_SEASON,
  footBonus,
  synergyApplies,
  synergyPower,
  teamSynergy,
  type SynergyPlayer,
} from './team-synergy.js';

// 4-3-3 자리: 0 GK · 1 FB(왼) · 2 CB · 3 CB · 4 FB(오른) · 5 DM · 6 CM · 7 AM · 8 W(왼) · 9 ST · 10 W(오른)
const L433 = presetLayout('4-3-3');
const p = (i: number, type: string | null, over: Partial<SynergyPlayer> = {}): SynergyPlayer => ({
  slot: L433[i]!.slot,
  x: L433[i]!.x,
  type,
  foot: '오른발',
  nation: 'KR',
  raised: false,
  ...over,
});
/** 4-3-3 선발(자리 번호 → 유형). 빠진 자리는 유스 선수. */
const lineup = (types: Record<number, string>, over: Partial<SynergyPlayer> = {}) =>
  Array.from({ length: 11 }, (_, i) => (types[i] ? p(i, types[i]!, over) : null));
const ids = (s: ReturnType<typeof teamSynergy>) => s.active.map((a) => a.id);

describe('T-11-105 듀오', () => {
  it('듀오 id는 겹치지 않는다', () => {
    expect(new Set(DUOS.map((d) => d.id)).size).toBe(DUOS.length);
  });
  it('흔한 듀오(킬패스·수호신)는 작게 켜진다', () => {
    const s = teamSynergy(lineup({ 0: 'shot', 2: 'stopper', 7: 'maker', 9: 'poacher' }));
    expect(ids(s)).toEqual(['killpass', 'guardian']);
    expect(s.lines).toEqual({ atk: 0.5, mid: 0, def: 0.5, gk: 0 });
  });
  it('자리가 맞지 않으면 켜지지 않는다(플레이메이커가 수비형 미드필더면 킬패스 아님)', () => {
    expect(ids(teamSynergy(lineup({ 5: 'maker', 9: 'poacher' })))).toEqual([]);
  });
  it('크로스 공식은 타깃맨 + 윙어 또는 공격형 풀백', () => {
    expect(ids(teamSynergy(lineup({ 9: 'target', 8: 'winger' })))).toContain('cross');
    expect(ids(teamSynergy(lineup({ 9: 'target', 4: 'fullback' })))).toContain('cross');
    expect(ids(teamSynergy(lineup({ 9: 'poacher', 8: 'winger' })))).not.toContain('cross');
  });
  it('철벽은 스토퍼 센터백이 둘 있어야 한다', () => {
    expect(ids(teamSynergy(lineup({ 0: 'wall', 2: 'stopper' })))).not.toContain('wall');
    const s = teamSynergy(lineup({ 0: 'wall', 2: 'stopper', 3: 'stopper' }));
    expect(ids(s)).toContain('wall');
    expect(s.active.find((a) => a.id === 'wall')!.members).toEqual([0, 2, 3]);
  });
  it('측면 오버래핑은 같은 쪽 측면이어야 한다', () => {
    expect(ids(teamSynergy(lineup({ 1: 'fullback', 8: 'winger' })))).toContain('overlap');
    expect(ids(teamSynergy(lineup({ 1: 'fullback', 10: 'winger' })))).not.toContain('overlap');
  });
  it('유스 선수·유형을 모르는 선수는 시너지에 들지 않는다', () => {
    const players = lineup({ 9: 'poacher' });
    players[7] = p(7, null);
    expect(ids(teamSynergy(players))).toEqual([]);
    expect(ids(teamSynergy(Array(11).fill(null)))).toEqual([]);
  });
  it('줄마다 상한, 듀오 합 상한을 넘지 않는다', () => {
    // 크로스 공식(공격 2) + 역습 한 방(공격 1.5) + 오버래핑(공격 1) + 킬패스(공격 0.5) → 공격은 상한에서 멈춘다.
    const s = teamSynergy(
      lineup({
        1: 'fullback',
        8: 'winger',
        9: 'target',
        10: 'speed',
        6: 'maker',
        7: 'maker',
        5: 'b2b',
        2: 'stopper',
        3: 'libero',
      }),
    );
    expect(s.lines.atk).toBeLessThanOrEqual(DUO_LINE_CAP);
    expect(synergyPower(s)).toBeLessThanOrEqual(DUO_TOTAL_CAP);
    expect(synergyPower(s)).toBe(DUO_TOTAL_CAP);
  });
});

describe('T-11-105 주발 맞춤', () => {
  it('풀백은 같은 쪽 발, 윙어는 반대쪽 발이면 +1, 양발은 +0.5', () => {
    expect(footBonus(p(1, 'fullback', { foot: '왼발' }))).toBe(1);
    expect(footBonus(p(1, 'fullback', { foot: '오른발' }))).toBe(0);
    expect(footBonus(p(4, 'fullback', { foot: '오른발' }))).toBe(1);
    expect(footBonus(p(8, 'winger', { foot: '오른발' }))).toBe(1);
    expect(footBonus(p(10, 'winger', { foot: '오른발' }))).toBe(0);
    expect(footBonus(p(10, 'winger', { foot: '양발' }))).toBe(0.5);
  });
  it('풀백·윙어가 아니거나 가운데 서면 보정이 없다', () => {
    expect(footBonus(p(9, 'poacher', { foot: '왼발' }))).toBe(0);
    expect(footBonus(p(1, 'fullback', { foot: '왼발', x: 50 }))).toBe(0);
    expect(footBonus(null)).toBe(0);
  });
});

describe('T-11-105 팀 색깔', () => {
  const full = (raised: number, nation = 'KR') =>
    Array.from({ length: 11 }, (_, i) => p(i, 'poacher', { raised: i < raised, nation }));
  it(`직접 키운 선수 ${HOMEGROWN_MIN}명부터 우리가 키운 팀`, () => {
    expect(ids(teamSynergy(full(HOMEGROWN_MIN - 1)))).not.toContain('homegrown');
    const s = teamSynergy(full(HOMEGROWN_MIN));
    expect(ids(s)).toContain('homegrown');
    expect(s.lines).toMatchObject({ atk: 1, mid: 1, def: 1, gk: 0 });
  });
  it(`같은 국적 ${NATIONAL_MIN}명이면 배지만 붙고 줄 힘은 그대로다`, () => {
    const players = full(0);
    const s = teamSynergy(players);
    expect(s.active.find((a) => a.id === 'national')?.kind).toBe('badge');
    expect(synergyPower(s)).toBe(0);
    players.slice(0, 5).forEach((x) => (x.nation = 'BR'));
    expect(ids(teamSynergy(players))).not.toContain('national');
  });
});

describe('T-11-105 줄 힘·시즌', () => {
  it('시너지를 주지 않으면 줄 힘은 지금과 같다', () => {
    const r = Array(11).fill(70);
    expect(lineStrength(FORMATIONS['4-3-3'], r, null)).toEqual(
      lineStrength(FORMATIONS['4-3-3'], r),
    );
  });
  it('주발 보정은 자리 실력에, 듀오는 줄 힘에 더한다', () => {
    const r = Array(11).fill(70);
    const base = lineStrength(FORMATIONS['4-3-3'], r);
    const s = teamSynergy(lineup({ 9: 'target', 8: 'winger' }, { foot: '오른발' }));
    const withSyn = lineStrength(FORMATIONS['4-3-3'], r, s);
    expect(s.foot[8]).toBe(1);
    expect(withSyn.atk - base.atk).toBeGreaterThan(2);
    expect(withSyn.gk).toBe(base.gk);
  });
  it(`경기 반영은 시즌 ${SYNERGY_FROM_SEASON}부터`, () => {
    expect(synergyApplies(0)).toBe(false);
    expect(synergyApplies(1)).toBe(false);
    expect(synergyApplies(SYNERGY_FROM_SEASON)).toBe(true);
  });
});
