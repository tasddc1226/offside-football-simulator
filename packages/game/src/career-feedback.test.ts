import { afterEach, describe, expect, it } from 'vitest';
import { setLocale } from '@offside/contracts/i18n';
import { CLUBS, TRAITS, TYPES } from './data.js';
import { newGame } from './engine.js';
import { continentalForRank, seasonSetup, transferOutlook } from './comps.js';
import { rivalName } from './rival-names.js';
import { DATING_EVENT } from './dating-event.js';
import { BASE_EVENTS } from './events.js';
import { LIFE_EVENTS } from './life-events.js';
import { MOMENT_EVENTS } from './moment-events.js';
import { natRefusing, natWindow, ntRetireAsk } from './national.js';
import { eventById } from './events-data.js';
import './event-registry.js';
import { en } from './i18n/en/index.js';
import { ja } from './i18n/ja/index.js';
import { createRng, setActiveRng } from './rng.js';
import type { GameState } from './types.js';

const player = (): GameState =>
  newGame(
    {
      name: 'QA',
      number: 7,
      pos: 'FW',
      foot: '오른발',
      type: TYPES.FW[0]!.id,
      trait: TRAITS[0]!.id,
    },
    238,
  );
afterEach(() => setLocale('ko'));

describe('destination preview agrees with the next season', () => {
  it('matches the actual continental competition for every eligible destination', () => {
    for (const club of CLUBS) {
      const s = player();
      const preview = transferOutlook(s, club.id, club.leagueId);
      if (!preview) continue;
      s.club = { ...club };
      s.leagueId = club.leagueId;
      seasonSetup(s, s.season);
      expect(s.season.comps?.find((c) => c.type === 'cont')?.name ?? null, club.id).toBe(
        preview.competition,
      );
    }
  });
  it('covers slot boundaries and unknown/amateur destinations', () => {
    expect(continentalForRank('pl', 4)).toBe('UCL');
    expect(continentalForRank('pl', 5)).toBe('UEL');
    expect(continentalForRank('pl', 7)).toBe('UECL');
    expect(continentalForRank('pl', 8)).toBeNull();
    expect(continentalForRank('l1', 4)).toBe('UEL');
    expect(transferOutlook(player(), 'missing', 'pl')).toBeNull();
    expect(transferOutlook(player(), 'hs-0', 'hs')).toBeNull();
  });
});

describe('rival names', () => {
  it.each(['j1', 'mls', 'ere', 'l1', 'bl', 'sa', 'll', 'pl'])(
    'uses local names in %s and keeps them after a transfer or reload',
    (leagueId) => {
      const s = player();
      s.leagueId = leagueId;
      setActiveRng(createRng(238));
      const ko = rivalName(s);
      expect(ko).toContain(' ');
      const saved = JSON.parse(JSON.stringify(s)) as GameState;
      saved.leagueId = 'k1';
      expect(rivalName(saved)).toBe(ko);
      setLocale('en', en);
      expect(rivalName(saved)).not.toMatch(/[가-힣]/);
      setLocale('ja', ja);
      expect(rivalName(saved)).not.toMatch(/[가-힣]/);
      expect(saved.flags.rivalName).toBe(ko);
    },
  );
  it('preserves old saved names without changing game state', () => {
    const s = player();
    s.flags.rivalName = '김민준';
    s.leagueId = 'pl';
    const before = JSON.stringify(s);
    expect(rivalName(s)).toBe('김민준');
    expect(JSON.stringify(s)).toBe(before);
  });
  it('does not change RNG consumption or the saved name with locale', () => {
    const states = ['ko', 'en', 'ja'].map((lang) => {
      setLocale(lang as 'ko' | 'en' | 'ja', lang === 'en' ? en : lang === 'ja' ? ja : undefined);
      const s = player();
      s.leagueId = 'pl';
      const rng = createRng(238);
      setActiveRng(rng);
      rivalName(s);
      return { name: s.flags.rivalName, next: rng.next() };
    });
    expect(states[1]).toEqual(states[0]);
    expect(states[2]).toEqual(states[0]);
  });
});

describe('dating rumor eligibility and choices', () => {
  it('requires an adult professional, fame and a playing phase', () => {
    const s = player();
    Object.assign(s, { age: 20, leagueId: 'pl', fame: 35, phase: 1 });
    expect(DATING_EVENT.cond(s)).toBe(true);
    for (const patch of [{ age: 19 }, { leagueId: 'hs' }, { fame: 34 }, { phase: 0 }]) {
      expect(DATING_EVENT.cond({ ...s, ...patch })).toBe(false);
    }
  });
  it('gives distinct modest effects without changing money or attributes', () => {
    const results = DATING_EVENT.choices.map((choice) => {
      const s = player();
      s.morale = 50;
      s.fame = 40;
      s.trust = 5;
      s.cond = 80;
      const before = { attrs: { ...s.attrs }, money: s.money };
      choice.ok.fx(s);
      expect({ attrs: s.attrs, money: s.money }).toEqual(before);
      return [s.morale, s.fame, s.trust, s.cond];
    });
    expect(new Set(results.map((x) => JSON.stringify(x))).size).toBe(3);
  });
});

describe('international retirement and the party follow-up (T-11-258)', () => {
  const veteran = () => {
    const s = player();
    Object.assign(s, { age: 31, leagueId: 'pl', phase: 1 });
    s.nat.caps = 10;
    return s;
  };
  it('asks veterans with 10+ caps once per season', () => {
    const s = veteran();
    expect(ntRetireAsk(s)).toBe(true);
    for (const patch of [{ age: 30 }, { flags: { ['ntAsk' + s.year]: 1 } }]) {
      expect(ntRetireAsk({ ...s, ...patch })).toBe(false);
    }
    expect(ntRetireAsk({ ...s, nat: { ...s.nat, caps: 9 } })).toBe(false);
    expect(ntRetireAsk({ ...s, nat: { ...s.nat, retired: s.year } })).toBe(false);
  });
  it('retiring ends call-ups and the captain armband but keeps caps', () => {
    const s = veteran();
    s.nat.captain = true;
    const ev = LIFE_EVENTS.find((e) => e.id === 'nt-retire')!;
    ev.choices[0]!.ok.fx(s);
    expect(s.nat.retired).toBe(s.year);
    expect(s.nat.caps).toBe(10);
    expect(ev.cond(s)).toBe(false);
    for (const phase of [1, 2, 3]) expect(natWindow({ ...s, phase })).toBeNull();
  });
  it('a good night at the party schedules one message per career', () => {
    const s = player();
    Object.assign(s, { age: 24, leagueId: 'pl', fame: 30 });
    const party = BASE_EVENTS.find((e) => e.id === 'party')!;
    party.choices[0]!.ok.fx(s);
    expect(s.chains.map((c) => c.id)).toContain('party-wags');
    s.chains = [];
    party.choices[0]!.ok.fx(s);
    expect(s.chains).toEqual([]);
    const wags = LIFE_EVENTS.find((e) => e.id === 'party-wags')!;
    expect(wags.choices).toHaveLength(3);
    wags.choices[1]!.ok.fx(s);
    expect(s.flags.wags).toBe(s.year);
    expect(wags.cond(s)).toBe(false);
  });
});

describe('career moment events', () => {
  const ev = (id: string) => MOMENT_EVENTS.find((e) => e.id === id)!;
  it('offers the World Cup snub only after missing last year’s World Cup squad', () => {
    const s = player();
    Object.assign(s, { leagueId: 'pl', phase: 0, year: 2027 });
    s.nat.caps = 12;
    s.nat.tours = [
      { year: 2026, name: '2026 FIFA 월드컵', stage: '16강', inSquad: false, apps: 0, goals: 0 },
    ];
    expect(ev('wc-snub').cond(s)).toBe(true);
    expect(ev('wc-snub').cond({ ...s, phase: 1 })).toBe(false);
    expect(ev('wc-snub').cond({ ...s, nat: { ...s.nat, caps: 0 } })).toBe(false);
    s.nat.tours[0]!.inSquad = true;
    expect(ev('wc-snub').cond(s)).toBe(false);
  });
  it('keeps a refusing player out of A-team call-ups for two seasons', () => {
    setActiveRng(createRng(255));
    const s = player();
    Object.assign(s, { leagueId: 'pl', phase: 1, year: 2027 });
    s.nat.captain = true;
    ev('wc-snub').choices[0]!.ok.fx(s);
    expect(s.nat.captain).toBe(false);
    expect(natRefusing(s)).toBe(true);
    expect(natWindow(s)).toBeNull();
    s.year = 2028;
    expect(natRefusing(s)).toBe(true);
    s.year = 2029;
    expect(natRefusing(s)).toBe(false);
  });
  it('gives the hat-trick event once per season to scorers', () => {
    const s = player();
    Object.assign(s, { leagueId: 'pl', phase: 1 });
    s.season.goals = 3;
    expect(ev('hat-trick').cond(s)).toBe(true);
    ev('hat-trick').choices[1]!.ok.fx(s);
    expect(ev('hat-trick').cond(s)).toBe(false);
    expect(ev('hat-trick').cond({ ...s, pos: 'GK', flags: {} })).toBe(false);
  });
  it('uses the player name in every language', () => {
    const s = player();
    expect(eventById('kid-autograph')!.text(s)).toContain('QA');
    for (const [locale, dict] of [
      ['en', en],
      ['ja', ja],
    ] as const) {
      setLocale(locale, dict);
      const e = eventById('kid-autograph')!;
      expect(e.text(s)).toContain('QA');
      expect(e.title).not.toMatch(/[가-힣]/);
    }
  });
});
