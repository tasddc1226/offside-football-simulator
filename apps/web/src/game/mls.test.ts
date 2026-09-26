import { describe, expect, it } from 'vitest';
import { CLUBS } from './data.js';
import { newGame, newSeason } from './engine.js';
import { compsPhase } from './comps.js';
import { makeOffers } from './season.js';
import { createRng, setActiveRng } from './rng.js';
import type { GameState } from './types.js';

// T-10-016 MLS: 30개 팀, US 오픈컵 · 리그스컵, 상위권은 CONCACAF 챔피언스컵(전 라운드 녹아웃).
const player = (seed: number, patch: Partial<GameState> = {}): GameState => {
  setActiveRng(createRng(seed));
  const s = newGame(
    { name: '홍길동', number: 7, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late' },
    seed,
  );
  Object.assign(s, patch);
  if (patch.age) for (const k of Object.keys(s.sub)) s.sub[k] = 74; // OVR은 세부 능력치로 매긴다 — 프로 주전급으로.

  s.season = newSeason(s);
  return s;
};
const mls = CLUBS.filter((c) => c.leagueId === 'mls');

describe('MLS (T-10-016)', () => {
  it('상위 클럽은 컵 두 개와 CONCACAF 챔피언스컵에 나가고, 챔피언스컵은 1라운드 녹아웃부터 한다', () => {
    const s = player(1, { leagueId: 'mls', club: { ...mls[0]! }, phase: 1 });
    compsPhase(s);
    const comps = s.season.comps!;
    expect(comps.filter((c) => c.type === 'cup').map((c) => c.name)).toEqual([
      'US 오픈컵',
      '리그스컵',
    ]);
    const ccc = comps.find((c) => c.type === 'cont')!;
    expect(ccc.name).toBe('CONCACAF 챔피언스컵');
    expect(['16강 진출', '1라운드 탈락']).toContain(ccc.stage);
  });

  it('고교·대학 선수에게는 MLS 오퍼가 오지 않고, MLS 오퍼는 주로 30대에게 온다', () => {
    const count = (patch: Partial<GameState>) => {
      let n = 0;
      for (let seed = 1; seed <= 300; seed++)
        n += makeOffers(player(seed, patch)).filter((o) => o.leagueId === 'mls').length;
      return n;
    };
    const k1 = CLUBS.find((c) => c.leagueId === 'k1')!;
    expect(count({ leagueId: 'hs', club: { ...CLUBS.find((c) => c.leagueId === 'hs')! } })).toBe(0);
    const young = count({ leagueId: 'k1', club: { ...k1 }, age: 24 });
    const veteran = count({ leagueId: 'k1', club: { ...k1 }, age: 31 });
    expect(young).toBeGreaterThan(0);
    expect(veteran).toBeGreaterThan(young * 3);
  });
});
