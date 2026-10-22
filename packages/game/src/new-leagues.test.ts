import { afterEach, describe, expect, it } from 'vitest';
import { CLUBS, LEAGUES } from './data.js';
import { newGame, newSeason } from './engine.js';
import { compsPhase, continentalForRank } from './comps.js';
import { makeOffers } from './season.js';
import { applyBalance, setLatestBalance } from './balance.js';
import { createRng, setActiveRng } from './rng.js';
import type { GameState } from './types.js';

// T-11-457 시즌 2 리그(중국 · 사우디 · 브라질 · 포르투갈). 밸런스 newLeagues가 켜져야 제의가 온다.
const ADDED = new Set(LEAGUES.filter((l) => l.added).map((l) => l.id));
const player = (seed: number, patch: Partial<GameState> = {}): GameState => {
  setActiveRng(createRng(seed));
  const s = newGame(
    { name: '홍길동', number: 7, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late' },
    seed,
  );
  Object.assign(s, patch);
  if (patch.age) for (const k of Object.keys(s.sub)) s.sub[k] = 76;
  s.season = newSeason(s);
  return s;
};
const k1 = CLUBS.find((c) => c.leagueId === 'k1')!;
const offersBy = (patch: Partial<GameState>) => {
  const n: Record<string, number> = {};
  for (let seed = 1; seed <= 300; seed++)
    for (const o of makeOffers(player(seed, patch)))
      if (ADDED.has(o.leagueId)) n[o.leagueId] = (n[o.leagueId] ?? 0) + 1;
  return n;
};

describe('시즌 2 리그 (T-11-457)', () => {
  afterEach(() => {
    setLatestBalance(null);
    applyBalance();
  });
  it('newLeagues가 꺼져 있으면 새 리그 제의가 없다', () => {
    expect(ADDED).toEqual(new Set(['csl', 'spl', 'bra', 'por']));
    expect(offersBy({ leagueId: 'k1', club: { ...k1 }, age: 30 })).toEqual({});
  });
  it('켜면 네 리그 모두에서 제의가 오고, 사우디 · 중국은 주로 베테랑에게 온다', () => {
    setLatestBalance({ version: 1, values: { newLeagues: 1 } });
    const veteran = offersBy({ leagueId: 'k1', club: { ...k1 }, age: 30 });
    const young = offersBy({ leagueId: 'k1', club: { ...k1 }, age: 24 });
    for (const id of ADDED) expect(veteran[id] ?? 0, id).toBeGreaterThan(0);
    const rich = (n: Record<string, number>) => (n.spl ?? 0) + (n.csl ?? 0);
    expect(rich(veteran)).toBeGreaterThan(rich(young) * 2);
    const hs = CLUBS.find((c) => c.leagueId === 'hs')!;
    const amateur = offersBy({ leagueId: 'hs', club: { ...hs } });
    expect((amateur.spl ?? 0) + (amateur.csl ?? 0) + (amateur.bra ?? 0)).toBe(0);
  });
  it('대륙 대회: 브라질은 리베르타도레스, 사우디 · 중국은 AFC, 포르투갈은 UEFA', () => {
    expect(continentalForRank('bra', 1)).toBe('LIB');
    expect(continentalForRank('spl', 1)).toBe('ACLE');
    expect(continentalForRank('csl', 4)).toBe('ACL2');
    expect(continentalForRank('por', 1)).toBe('UCL');
    setLatestBalance({ version: 1, values: { newLeagues: 1 } });
    const bra = CLUBS.filter((c) => c.leagueId === 'bra');
    const s = player(3, { leagueId: 'bra', club: { ...bra[0]! }, phase: 1 });
    compsPhase(s);
    const comps = s.season.comps!;
    expect(comps.filter((c) => c.type === 'cup').map((c) => c.name)).toEqual(['코파 두 브라질']);
    const lib = comps.find((c) => c.type === 'cont')!;
    expect(lib.name).toBe('코파 리베르타도레스');
    expect(lib.played).toBe(6);
  });
});
