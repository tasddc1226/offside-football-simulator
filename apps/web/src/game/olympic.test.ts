import { describe, expect, it } from 'vitest';
import './index.js';
import { CLUBS } from './data.js';
import { EVENTS } from './events-data.js';
import { newGame, newSeason } from './engine.js';
import { natInit, natSeasonEnd } from './national.js';
import { createRng, setActiveRng } from './rng.js';
import type { GameState } from './types.js';

// T-10-016 올림픽: 아시아 예선(AFC U-23 아시안컵)을 통과해야 본선에 나가고, 해외 구단 소속이면 차출 협상이 필요하다.
const youngster = (seed: number, year: number, leagueId: string): GameState => {
  setActiveRng(createRng(seed));
  const s = newGame({ name: '홍길동', number: 7, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late' }, seed);
  for (const k of Object.keys(s.sub)) s.sub[k] = 80; // U-23 대표팀 주전급
  s.leagueId = leagueId;
  s.club = { ...CLUBS.find((c) => c.leagueId === leagueId)! };
  Object.assign(s, { year, age: 22, fame: 60, phase: 0 });
  s.season = newSeason(s);
  natInit(s);
  return s;
};
const olympicOf = (s: GameState) => natSeasonEnd(s).tours.find((t) => t.name.includes('올림픽 남자축구'));

describe('올림픽 예선 · 차출 (T-10-016)', () => {
  it('올림픽 전 해에 아시아 예선 결과가 정해지고, 예선에서 떨어지면 본선도 특례도 없다', () => {
    const s = youngster(1, 2027, 'k1');
    const qual = natSeasonEnd(s).tours.find((t) => t.name === '2028 올림픽 아시아 예선 (AFC U-23 아시안컵)')!;
    expect(qual.stage).toBe(s.nat.qual[2028] ? '본선 진출 확정' : '본선 진출 실패');

    const out = youngster(2, 2028, 'k1');
    out.nat.qual[2028] = false;
    expect(olympicOf(out)).toMatchObject({ stage: '본선 진출 실패', inSquad: false });
    expect(out.mil.exempt).toBeNull();
  });

  it('해외 구단이 차출을 거부하면 올림픽 명단에서 빠진다', () => {
    const s = youngster(3, 2028, 'bl');
    s.nat.qual[2028] = true;
    s.flags.olyRel2028 = false;
    expect(olympicOf(s)).toMatchObject({ inSquad: false, why: '소속팀이 차출을 거부' });
  });

  it('올림픽 해에 해외파 U-23 대표 후보에게 차출 협상 이벤트가 뜬다 — 예선 탈락이면 뜨지 않는다', () => {
    const ev = EVENTS.find((e) => e.id === 'oly-release')!;
    const s = youngster(4, 2028, 'bl');
    expect(ev.cond!(s)).toBe(true);
    s.nat.qual[2028] = false;
    expect(ev.cond!(s)).toBe(false);
    expect(ev.cond!(youngster(5, 2028, 'k1'))).toBe(false); // K리그는 협상 없이 보내 준다.
  });

  it('올림픽·아시안게임(U-23) 경기는 대회 기록에만 남고 A매치 출전·골로 세지 않는다', () => {
    const s = youngster(6, 2028, 'k1');
    s.nat.qual[2028] = true;
    const oly = olympicOf(s)!;
    expect(oly.inSquad).toBe(true);
    expect(oly.apps).toBeGreaterThan(0);
    expect(s.nat).toMatchObject({ caps: 0, goals: 0, assists: 0 });
  });
});
