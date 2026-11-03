import { describe, expect, it } from 'vitest';
import { FORMATIONS, lineStrength, presetLayout } from './owner-team.js';
import { SPECIAL_SYNERGIES } from './manager-rules.js';
import {
  CLUB_EFFECT,
  DUOS,
  LEAGUE_MIN,
  LEAGUE_STYLES,
  HOMEGROWN_MIN,
  NATIONAL_MIN,
  NATIONAL_POWER,
  NATION_STYLES,
  CONFED_STYLES,
  SYNERGY_FROM_SEASON,
  SYNERGY_S2_SEASON,
  duosFor,
  footBonus,
  nationStyle,
  nationStyleById,
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
  // 국적을 번갈아 둬 국가대표 라인업(같은 국적 7명)이 다른 규칙의 검사에 끼지 않게 한다.
  nation: i % 2 ? 'JP' : 'KR',
  raised: false,
  ...over,
});
/** 4-3-3 선발(자리 번호 → 유형). 빠진 자리는 유스 선수. */
const lineup = (types: Record<number, string>, over: Partial<SynergyPlayer> = {}) =>
  Array.from({ length: 11 }, (_, i) => (types[i] ? p(i, types[i]!, over) : null));
const ids = (s: ReturnType<typeof teamSynergy>) => s.active.map((a) => a.id);
const duoIds = (s: ReturnType<typeof teamSynergy>) =>
  s.active.filter((a) => a.kind === 'duo').map((a) => a.id);

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
  it('T-11-197 켜진 듀오의 효과를 상한 없이 모두 더한다', () => {
    // 크로스 공식(공격 2) + 역습 한 방(공격 1.5) + 오버래핑(공격 1 · 중원 0.5) + 중원 엔진(중원 2) + 센터백 짝꿍(수비 1.5 · 중원 0.5).
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
    // T-11-542 삼지창(공격 1 · 중원 0.5) + 앵커(수비 0.5)도 함께 켜진다.
    expect(s.lines).toEqual({ atk: 5.5, mid: 3.5, def: 2, gk: 0 });
    expect(synergyPower(s)).toBe(11);
  });
});

describe('T-11-542 시즌 2 트리오 · 듀오', () => {
  it('기존 듀오 id는 그대로 남는다(경기 기록 · 감독 특기)', () => {
    const all = DUOS.map((d) => d.id);
    for (const id of [
      'cross',
      'engine',
      'wall',
      'cb_pair',
      'buildup',
      'counter',
      'overlap',
      'killpass',
      'guardian',
    ])
      expect(all).toContain(id);
    for (const ids of Object.values(SPECIAL_SYNERGIES))
      for (const id of ids) expect([...all, 'homegrown']).toContain(id);
  });
  it('새 시너지의 줄 효과는 0.5~2 안이다', () => {
    for (const d of DUOS)
      for (const v of Object.values(d.effect)) {
        expect(v).toBeGreaterThanOrEqual(0.5);
        expect(v).toBeLessThanOrEqual(2);
      }
  });
  it('삼지창은 윙어 + 스트라이커 + 또 한 명의 윙어·스피드스터(겹치는 유형 조건도 찾는다)', () => {
    // 왼쪽이 스피드스터, 오른쪽이 윙어여도 앞 조건을 되돌려 채운다.
    const s = teamSynergy(lineup({ 8: 'speed', 9: 'poacher', 10: 'winger' }));
    expect(s.active.find((a) => a.id === 'trident')?.members).toEqual([8, 9, 10]);
    expect(duoIds(teamSynergy(lineup({ 8: 'speed', 9: 'poacher', 10: 'speed' })))).not.toContain(
      'trident',
    );
    expect(duoIds(teamSynergy(lineup({ 8: 'winger', 10: 'winger' })))).not.toContain('trident');
  });
  it('중원 삼각형은 플레이메이커 · 박스 투 박스 · 윙어가 모두 중원에', () => {
    const s = teamSynergy(lineup({ 5: 'b2b', 6: 'maker', 7: 'winger' }));
    expect(duoIds(s)).toEqual(['triangle', 'engine']);
    expect(s.lines).toEqual({ atk: 0.5, mid: 3, def: 0, gk: 0 });
    // 윙어가 측면 공격(W)에 서면 중원 삼각형이 아니다.
    expect(duoIds(teamSynergy(lineup({ 5: 'b2b', 6: 'maker', 8: 'winger' })))).not.toContain(
      'triangle',
    );
  });
  it('스리백은 빌드업 센터백이 하나 이상 든 센터백 셋', () => {
    const L352 = presetLayout('3-5-2');
    const back = (types: string[]) =>
      teamSynergy(
        L352.map(({ slot, x }, i) =>
          i >= 1 && i <= 3
            ? { slot, x, type: types[i - 1]!, foot: null, nation: 'KR', raised: false }
            : null,
        ),
      );
    expect(duoIds(back(['stopper', 'libero', 'stopper']))).toEqual(['back_three', 'cb_pair']);
    expect(duoIds(back(['libero', 'libero', 'libero']))).toEqual(['back_three']);
    expect(duoIds(back(['stopper', 'stopper', 'stopper']))).not.toContain('back_three');
  });
  it('양 날개 · 양쪽 풀백은 반대쪽 측면 둘, 측면 전환은 윙어와 반대쪽 풀백', () => {
    expect(duoIds(teamSynergy(lineup({ 8: 'winger', 10: 'winger' })))).toContain('wings');
    expect(duoIds(teamSynergy(lineup({ 1: 'fullback', 4: 'fullback' })))).toContain('wingbacks');
    const same = lineup({ 1: 'fullback', 4: 'fullback' });
    same[4] = { ...same[4]!, x: 20 };
    expect(duoIds(teamSynergy(same))).not.toContain('wingbacks');
    expect(duoIds(teamSynergy(lineup({ 10: 'winger', 1: 'fullback' })))).toEqual(['switch']);
    expect(duoIds(teamSynergy(lineup({ 8: 'winger', 1: 'fullback' })))).toEqual(['overlap']);
  });
  it('새 듀오는 정해진 자리에서만 켜진다', () => {
    // 4-3-3 자리 5는 DM, 6은 CM, 7은 AM.
    expect(duoIds(teamSynergy(lineup({ 5: 'b2b', 2: 'stopper' })))).toEqual(['anchor']);
    expect(duoIds(teamSynergy(lineup({ 6: 'b2b', 2: 'stopper' })))).toEqual([]);
    expect(duoIds(teamSynergy(lineup({ 5: 'maker', 3: 'libero' })))).toEqual(['regista']);
    expect(duoIds(teamSynergy(lineup({ 5: 'b2b', 6: 'b2b' })))).toEqual(['double_pivot']);
    expect(duoIds(teamSynergy(lineup({ 7: 'winger', 9: 'poacher' })))).toEqual(['shadow']);
    expect(duoIds(teamSynergy(lineup({ 0: 'sweeper', 4: 'fullback' })))).toEqual(['high_line']);
    const L442 = presetLayout('4-4-2');
    const twoUp = L442.map(({ slot, x }, i) =>
      i === 9 || i === 10
        ? { slot, x, type: i === 9 ? 'target' : 'poacher', foot: null, nation: 'KR', raised: false }
        : null,
    );
    expect(duoIds(teamSynergy(twoUp))).toEqual(['big_small']);
  });
});

describe('T-11-542 시즌 경계', () => {
  it(`새 트리오 · 듀오는 시즌 ${SYNERGY_S2_SEASON}부터 켜진다(지난 시즌 경기 · 팀은 그 시즌 규칙)`, () => {
    const players = lineup({ 8: 'winger', 9: 'poacher', 10: 'winger', 6: 'maker', 7: 'maker' });
    expect(duoIds(teamSynergy(players, SYNERGY_S2_SEASON - 1))).toEqual(['killpass']);
    expect(duoIds(teamSynergy(players, SYNERGY_S2_SEASON))).toEqual([
      'trident',
      'killpass',
      'wings',
    ]);
    expect(duoIds(teamSynergy(players))).toEqual(duoIds(teamSynergy(players, SYNERGY_S2_SEASON)));
    expect(duosFor(SYNERGY_S2_SEASON - 1).map((d) => d.id)).toEqual([
      'cross',
      'engine',
      'wall',
      'cb_pair',
      'buildup',
      'counter',
      'overlap',
      'killpass',
      'guardian',
    ]);
  });
  it('새 나라 색깔도 시즌 2부터, 그 전 시즌은 대륙연맹 색깔', () => {
    const be = Array.from({ length: 11 }, (_, i) => p(i, null, { nation: 'BE' }));
    const s1 = teamSynergy(be, SYNERGY_S2_SEASON - 1).active.find((a) => a.id === 'national');
    const s2 = teamSynergy(be, SYNERGY_S2_SEASON).active.find((a) => a.id === 'national');
    expect(s1).toMatchObject({ style: 'uefa', effect: CONFED_STYLES.UEFA.effect });
    expect(s2).toMatchObject({ style: 'be_golden', effect: NATION_STYLES.BE!.effect });
    expect(nationStyleById('be_golden')?.name).toBe(NATION_STYLES.BE!.name);
    expect(nationStyleById('uefa')).toBe(CONFED_STYLES.UEFA);
    // 원래 있던 나라는 시즌과 상관없이 그대로.
    expect(nationStyle('KR', 1)).toBe(NATION_STYLES.KR);
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
  const full = (raised: number, nation?: string) =>
    Array.from({ length: 11 }, (_, i) =>
      p(i, 'poacher', { raised: i < raised, ...(nation ? { nation } : {}) }),
    );
  it(`직접 키운 선수 ${HOMEGROWN_MIN}명부터 우리가 키운 팀`, () => {
    expect(ids(teamSynergy(full(HOMEGROWN_MIN - 1)))).not.toContain('homegrown');
    const s = teamSynergy(full(HOMEGROWN_MIN));
    expect(ids(s)).toContain('homegrown');
    expect(s.lines).toMatchObject({ atk: 1, mid: 1, def: 1, gk: 0 });
  });
  it(`어느 나라든 같은 국적 ${NATIONAL_MIN}명이면 국가대표 라인업 효과가 붙는다`, () => {
    const players = full(0, 'KR');
    const s = teamSynergy(players);
    expect(s.active.find((a) => a.id === 'national')).toMatchObject({
      kind: 'team',
      nation: 'KR',
      style: 'kr_press',
    });
    expect(s.lines).toMatchObject({ atk: 0, mid: 1, def: 0.5, gk: 0 });
    players.slice(0, 5).forEach((x) => (x.nation = 'BR'));
    expect(ids(teamSynergy(players))).not.toContain('national');
    players.slice(0, 7).forEach((x) => (x.nation = 'JP'));
    const jp = teamSynergy(players);
    expect(jp.active.find((a) => a.id === 'national')).toMatchObject({
      style: 'jp_pass',
      members: [0, 1, 2, 3, 4, 5, 6],
    });
    expect(jp.lines).toMatchObject({ atk: 0.5, mid: 1 });
    // 표에 없는 나라는 대륙연맹 색깔.
    players.forEach((x) => (x.nation = 'NZ'));
    expect(teamSynergy(players).active.find((a) => a.id === 'national')?.style).toBe('ofc');
  });
  it('T-11-542 고유 색깔이 있는 나라는 23개(공개 가이드 문구와 같이 고친다)', () => {
    expect(Object.keys(NATION_STYLES)).toHaveLength(23);
    expect(new Set(Object.values(NATION_STYLES).map((st) => st.id)).size).toBe(23);
  });
  it('나라별 색깔은 합이 모두 같다', () => {
    for (const st of [...Object.values(NATION_STYLES), ...Object.values(CONFED_STYLES)])
      expect(Object.values(st.effect).reduce((t, v) => t + (v ?? 0), 0)).toBe(NATIONAL_POWER);
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
    expect(synergyApplies(SYNERGY_FROM_SEASON)).toBe(true);
  });
});

describe('T-11-467 리그 컬러 · 클럽 동료', () => {
  const all = (over: (i: number) => Partial<SynergyPlayer>) =>
    Array.from({ length: 11 }, (_, i) => p(i, null, over(i)));
  it('리그 스타일은 어느 리그든 합이 국가대표와 같다', () => {
    for (const st of Object.values(LEAGUE_STYLES))
      expect(Object.values(st.effect).reduce((t, v) => t + (v ?? 0), 0)).toBeCloseTo(
        NATIONAL_POWER,
      );
  });
  it('같은 주 리그 7명이면 리그 컬러가 켜진다', () => {
    const s = teamSynergy(all((i) => ({ league: i < LEAGUE_MIN ? 'll' : 'pl' })));
    expect(s.active.find((a) => a.id === 'league')).toMatchObject({
      league: 'll',
      style: 'll_skill',
      effect: LEAGUE_STYLES.ll!.effect,
    });
    expect(synergyPower(s)).toBeCloseTo(NATIONAL_POWER);
    expect(
      ids(teamSynergy(all((i) => ({ league: i < LEAGUE_MIN - 1 ? 'll' : 'pl' })))),
    ).not.toContain('league');
  });
  it('국가대표와 함께 켜지면 인원이 많은 쪽만 효과가 있다(같으면 국가대표)', () => {
    const more = teamSynergy(all((i) => ({ nation: i < 7 ? 'KR' : 'JP', league: 'pl' })));
    expect(more.active.find((a) => a.id === 'league')?.effect).toEqual(LEAGUE_STYLES.pl!.effect);
    expect(more.active.find((a) => a.id === 'national')?.effect).toEqual({});
    expect(synergyPower(more)).toBeCloseTo(NATIONAL_POWER);
    const tie = teamSynergy(
      all((i) => ({ nation: i < 8 ? 'KR' : 'JP', league: i < 8 ? 'pl' : 'll' })),
    );
    expect(tie.active.find((a) => a.id === 'national')?.effect).toEqual(NATION_STYLES.KR!.effect);
    expect(tie.active.find((a) => a.id === 'league')?.effect).toEqual({});
  });
  it('같은 주 클럽 3명이면 가장 많은 클럽 하나만 클럽 동료가 된다', () => {
    const club = (i: number) => (i < 3 ? 'pl-1' : i < 7 ? 'll-2' : null);
    const s = teamSynergy(all((i) => ({ club: club(i) })));
    const c = s.active.filter((a) => a.id === 'club');
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ club: 'll-2', members: [3, 4, 5, 6], effect: CLUB_EFFECT });
    expect(ids(teamSynergy(all((i) => ({ club: i < 2 ? 'pl-1' : null }))))).not.toContain('club');
  });
  it('주 리그 · 클럽을 모르는 선수는 들지 않는다', () => {
    const s = teamSynergy(all(() => ({})));
    expect(ids(s)).not.toContain('league');
    expect(ids(s)).not.toContain('club');
  });
});
