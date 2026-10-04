import { describe, expect, it } from 'vitest';
import './index.js';
import { BODY_DEFAULT } from '@offside/contracts/body';
import { CLUBS, TYPES } from './data.js';
import { bodyMods, ovr } from './attributes.js';
import { newGame, newSeason } from './engine.js';
import { milDone, milOptions } from './military.js';
import { natInit, natSeasonEnd, natSide, NAT_STR_K } from './national.js';
import { isNationalTeam } from './nation.js';
import { createRng, setActiveRng } from './rng.js';
import { checkTitles, TITLES } from './titles.js';
import type { GameState } from './types.js';
import type { Body } from '@offside/contracts/body';

// T-10-096 국적·체격. 대한민국(국적 없는 저장)은 예전과 한 글자도 다르지 않아야 한다.
const make = (seed: number, o: { nation?: string; body?: Body; pos?: GameState['pos'] } = {}) => {
  setActiveRng(createRng(seed));
  return newGame(
    {
      name: '홍길동',
      number: 7,
      foot: '오른발',
      trait: 'late',
      ...o,
      pos: o.pos ?? 'FW',
      type: TYPES[o.pos ?? 'FW'][0]!.id,
    },
    seed,
  );
};
const star = (seed: number, nation: string | undefined, year: number, leagueId = 'pl') => {
  const s = make(seed, nation ? { nation } : {});
  for (const k of Object.keys(s.sub)) s.sub[k] = 88;
  s.leagueId = leagueId;
  s.club = { ...CLUBS.find((c) => c.leagueId === leagueId)! };
  Object.assign(s, { year, age: 22, fame: 70, phase: 0 });
  s.season = newSeason(s);
  natInit(s);
  return s;
};
const strip = (s: GameState) => ({ ...s, cid: '' });

describe('T-10-096 국적', () => {
  it('대한민국을 고르면 국적을 넘기지 않은 예전 선수와 같은 상태다', () => {
    expect(strip(make(11, { nation: 'KR' }))).toEqual(strip(make(11)));
    expect(make(11, { nation: 'KR' }).nation).toBeUndefined();
  });

  it('외국 국적은 유학생으로 시작하고, 병역이 없다', () => {
    const s = make(12, { nation: 'BR' });
    expect(s.nation).toBe('BR');
    expect(s.log.some((l) => l.text.includes('브라질에서 축구 유학을 온'))).toBe(true);
    expect(milDone(s)).toBe(true);
    Object.assign(s, { age: 28, leagueId: 'k1' });
    expect(milOptions(s)).toEqual([]);
  });

  it('대표팀 전력은 나라 전력 차의 절반만 반영하고, 상대 표에서 자기 나라를 뺀다', () => {
    const kr = natSide(make(1));
    const fr = natSide(make(1, { nation: 'FR' }));
    expect(kr.name).toBe('대한민국');
    expect(fr.name).toBe('프랑스');
    expect(fr.str - kr.str).toBeCloseTo((88 - 75) * NAT_STR_K);
    expect(fr.conf).toBe('UEFA');
    expect([...fr.pool, ...fr.world].some(([n]) => n === '프랑스')).toBe(false);
    expect(natSide(make(1, { nation: 'JP' })).pool.some(([n]) => n === '대한민국')).toBe(true);
  });

  it('대륙컵은 연맹마다 다르고, 아시안게임은 아시아 나라만 나간다', () => {
    const names = (s: GameState) => natSeasonEnd(s).tours.map((t) => t.name);
    // 2028: 유로·코파·OFC 네이션스컵·올림픽. 2027: 아시안컵·아프리카 네이션스컵·골드컵. 2030: 월드컵·아시안게임.
    expect(names(star(3, 'FR', 2028)).some((n) => n.startsWith('UEFA 유로 2028'))).toBe(true);
    expect(names(star(3, 'AR', 2028)).some((n) => n.includes('코파 아메리카'))).toBe(true);
    expect(names(star(3, 'NG', 2027)).some((n) => n.includes('아프리카 네이션스컵'))).toBe(true);
    expect(names(star(3, 'US', 2027)).some((n) => n.includes('CONCACAF 골드컵'))).toBe(true);
    expect(names(star(3, 'KR', 2027)).some((n) => n.includes('AFC 아시안컵'))).toBe(true);
    expect(names(star(3, 'JP', 2030)).some((n) => n.includes('아시안게임'))).toBe(true);
    expect(names(star(3, 'FR', 2030)).some((n) => n.includes('아시안게임'))).toBe(false);
    expect(names(star(3, 'FR', 2029)).some((n) => n.includes('월드컵 유럽 예선'))).toBe(true);
  });

  it('대표팀 트로피는 그 나라 이름으로 남고, 외국 국적은 병역 특례를 받지 않는다', () => {
    for (let seed = 1; seed < 400; seed++) {
      const s = star(seed, 'JP', 2030);
      const { trophies } = natSeasonEnd(s);
      if (!trophies.includes('아시안게임 금메달')) continue;
      expect(s.mil.exempt).toBeNull();
      expect(isNationalTeam('일본')).toBe(true);
      return;
    }
    throw new Error('아시안게임 금메달 표본을 찾지 못했다');
  });

  it('칭호 — 외국 국적은 태극전사 대신 국가대표, 자기 대륙컵 칭호만 얻을 수 있다', () => {
    const s = make(5, { nation: 'FR' });
    s.nat.caps = 1;
    s.trophies.push({ year: 2028, t: 'UEFA 유로 우승', club: '프랑스' });
    const got = checkTitles(s).map((d) => d.id);
    expect(got).toContain('ntdebutx');
    expect(got).toContain('euro');
    expect(got).not.toContain('ntdebut');
    const avail = TITLES.filter((d) => !d.avail || d.avail(s)).map((d) => d.id);
    expect(avail).not.toContain('asiancup');
    expect(avail).not.toContain('mil');
    const kr = make(5);
    expect(
      TITLES.filter((d) => d.avail && !d.avail(kr))
        .map((d) => d.id)
        .sort(),
    ).toEqual(['afcon', 'copa', 'euro', 'goldcup', 'ntdebutx', 'ofcup']);
  });
});

describe('T-10-096 체격', () => {
  it('포지션 기본 체격은 보정이 없고, 예전 선수와 능력치가 같다', () => {
    expect(bodyMods({ pos: 'FW', body: BODY_DEFAULT.FW })).toEqual({});
    const s = make(21, { body: BODY_DEFAULT.FW });
    expect(s.sub).toEqual(make(21).sub);
  });

  it('큰 키는 헤딩·점프에, 작은 키는 민첩·가속에 유리하고 한 능력치 보정은 3을 넘지 않는다', () => {
    const tall = bodyMods({ pos: 'FW', body: { h: 200, w: 92 } });
    const short = bodyMods({ pos: 'FW', body: { h: 160, w: 58 } });
    expect(tall.hea).toBeGreaterThan(0);
    expect(tall.agi).toBeLessThan(0);
    expect(short.agi).toBeGreaterThan(0);
    expect(short.hea).toBeLessThan(0);
    for (const v of [...Object.values(tall), ...Object.values(short)])
      expect(Math.abs(v)).toBeLessThanOrEqual(3);
  });

  it('체격은 능력치 분포만 바꾸고 시작 OVR은 같다', () => {
    for (const pos of ['FW', 'MF', 'DF', 'GK'] as const) {
      const base = ovr(make(31, { pos }));
      expect(ovr(make(31, { pos, body: { h: 200, w: 95 } }))).toBeCloseTo(base, 0);
      expect(ovr(make(31, { pos, body: { h: 160, w: 55 } }))).toBeCloseTo(base, 0);
    }
  });
});
