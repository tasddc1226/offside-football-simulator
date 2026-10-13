import { afterEach, describe, expect, it } from 'vitest';
import { setLocale } from '@offside/contracts/i18n';
import { CLUBS, TRAITS, TYPES } from './data.js';
import { newGame } from './engine.js';
import { continentalForRank, seasonSetup, transferOutlook } from './comps.js';
import { rivalName } from './rival-names.js';
import { DATING_EVENT } from './dating-event.js';
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
