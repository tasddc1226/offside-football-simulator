import { describe, expect, it } from 'vitest';
import { CLUBS } from './data.js';
import { newGame, newSeason } from './engine.js';
import { compsPhase, drawOpponent } from './comps.js';
import { createRng, rnd, setActiveRng } from './rng.js';
import type { GameState, SeasonComp } from './types.js';

// T-11-261 대륙 대회 녹아웃 대진 — 상대 이름은 RNG 없이 정하고, 치른 승부를 시즌 대회 기록에 남긴다.
const pl = CLUBS.filter((c) => c.leagueId === 'pl');
const player = (seed: number, patch: Partial<GameState> = {}): GameState => {
  setActiveRng(createRng(seed));
  const s = newGame(
    { name: '홍길동', number: 7, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late' },
    seed,
  );
  Object.assign(s, { age: 24, leagueId: 'pl', club: { ...pl[0]! }, phase: 1 }, patch);
  for (const k of Object.keys(s.sub)) s.sub[k] = 82; // 빅클럽 주전급
  s.season = newSeason(s);
  return s;
};
const cont = (s: GameState): SeasonComp => s.season.comps!.find((c) => c.type === 'cont')!;
const leagueOfClub = (id: string) => CLUBS.find((c) => c.id === id)?.leagueId;
/** 리그 페이즈를 통과한(16강 직행·녹아웃 PO) 시드 하나. */
function throughLeaguePhase(): GameState {
  for (let seed = 1; seed < 200; seed++) {
    const s = player(seed);
    compsPhase(s);
    if (cont(s).alive) return s;
  }
  throw new Error('no seed passed the league phase');
}

describe('대륙 대회 녹아웃 대진 (T-11-261)', () => {
  it('리그 페이즈를 통과하면 다음 상대가 미리 추첨되고, 같은 리그 구단은 아니다', () => {
    const s = throughLeaguePhase();
    const c = cont(s);
    expect(c.name).toBe('UEFA 챔피언스리그');
    expect(c.bracket?.path).toEqual([]);
    const next = c.bracket!.next!;
    expect(next.stage).toBe(c.stage === '16강 직행' ? '16강' : '녹아웃 PO');
    expect(next.legs).toBe(2);
    expect(next.opp).not.toBe(s.club.id);
    expect(leagueOfClub(next.opp)).not.toBe('pl');
    expect(['ll', 'bl', 'sa', 'l1', 'ere']).toContain(leagueOfClub(next.opp));
  });

  it('후반기에 녹아웃을 치르면 미리 추첨한 상대부터 경로에 남고, 경기 줄의 상대와 같다', () => {
    const s = throughLeaguePhase();
    const c = cont(s);
    const next = c.bracket!.next!;
    s.phase = 2;
    const lines = compsPhase(s);
    const b = c.bracket!;
    expect(b.next).toBeUndefined();
    expect(b.path[0]).toMatchObject({ stage: next.stage, opp: next.opp, legs: 2 });
    expect(c.alive).toBe(false);
    const last = b.path.at(-1)!;
    if (c.stage === '우승') expect(last).toMatchObject({ stage: '결승', won: true });
    else if (c.stage === '준우승') expect(last).toMatchObject({ stage: '결승', won: false });
    else expect(last.won).toBe(false);
    expect(b.path.slice(0, -1).every((t) => t.won)).toBe(true);
    expect(new Set(b.path.map((t) => t.opp)).size).toBe(b.path.length);
    const games = lines.flatMap((l) => l.games).filter((g) => g.opp);
    expect(games.length).toBe(b.path.reduce((n, t) => n + t.legs, 0));
    for (const t of b.path)
      expect(games.filter((g) => g.stage === t.stage).every((g) => g.opp === t.opp)).toBe(true);
  });

  it('상대 추첨은 RNG를 쓰지 않고 같은 상태에서 같은 구단을 고른다', () => {
    const s = throughLeaguePhase();
    const c = cont(s);
    setActiveRng(createRng(77));
    const a = rnd();
    setActiveRng(createRng(77));
    const first = drawOpponent(s, c, '8강', 85);
    const second = drawOpponent(s, c, '8강', 85);
    expect(first).toBe(second);
    expect(rnd()).toBe(a);
  });

  it('대진 기록이 없는 옛 세이브도 녹아웃을 치르면 그때부터 남긴다', () => {
    const s = throughLeaguePhase();
    const c = cont(s);
    c.bracket = undefined;
    s.phase = 2;
    compsPhase(s);
    expect(c.bracket!.path.length).toBeGreaterThan(0);
    expect(['16강', '녹아웃 PO']).toContain(c.bracket!.path[0]!.stage);
    expect(c.bracket!.next).toBeUndefined();
  });
});
