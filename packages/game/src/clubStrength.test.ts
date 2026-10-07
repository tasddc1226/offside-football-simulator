import { afterEach, describe, expect, it } from 'vitest';
import './index.js';
import { CLUB_STRENGTH } from './club-strength-data.js';
import {
  adoptClubStrength,
  applyClubStrength,
  baseStr,
  useCareerClubStrength,
} from './clubStrength.js';
import { checkStandings, computeStrength, type StandingRow } from './clubStrengthCalc.js';
import { CLUBS } from './data.js';
import { newGame, newSeason } from './engine.js';
import { createRng, setActiveRng } from './rng.js';
import type { GameState } from './types.js';

// T-11-135 구단 전력표: 커리어마다 버전을 저장하고, 새 버전은 다음 시즌 시작부터 적용한다.
const game = (seed = 1) => {
  setActiveRng(createRng(seed));
  return newGame(
    { name: '홍길동', number: 7, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late' },
    seed,
  );
};
const str = (id: string) => CLUBS.find((c) => c.id === id)!.str;
const [someId, someStr] = Object.entries(CLUB_STRENGTH.values)[0]!;

afterEach(() => applyClubStrength());

describe('구단 전력표 채택', () => {
  it('전력표에 값이 있다(v1 이상)', () => {
    expect(CLUB_STRENGTH.v).toBeGreaterThanOrEqual(1);
    expect(someStr).not.toBe(baseStr(someId));
  });

  it('새 커리어는 첫 시즌부터 최신 전력표를 쓴다', () => {
    const s = game();
    expect(s.cs).toEqual({ v: CLUB_STRENGTH.v, values: CLUB_STRENGTH.values });
    expect(str(someId)).toBe(someStr);
  });

  it('전력표가 없던 옛 세이브는 불러올 때 기본 전력, 다음 시즌부터 새 전력', () => {
    const s: GameState = game();
    delete s.cs;
    s.leagueId = 'k1';
    s.club = { ...CLUBS.find((c) => c.id === someId)!, str: baseStr(someId)! };
    useCareerClubStrength(s);
    expect(str(someId)).toBe(baseStr(someId));
    s.career.push({} as GameState['career'][number]);
    const before = s.log.length;
    s.season = newSeason(s);
    expect((s as GameState).cs?.v).toBe(CLUB_STRENGTH.v);
    expect(str(someId)).toBe(someStr);
    // 세이브에 복사돼 있던 내 구단 전력도 새 값으로
    expect(s.club.str).toBe(someStr);
    expect(s.log.length).toBe(before + 1);
  });

  it('같은 버전이면 다시 들이지 않고 소식도 남기지 않는다', () => {
    const s = game();
    s.career.push({} as GameState['career'][number]);
    expect(adoptClubStrength(s)).toBe(false);
  });

  it('커리어에 저장된 값이 정적 표보다 우선한다(그 시즌 동안 같은 값)', () => {
    const s = game();
    s.cs = { v: CLUB_STRENGTH.v, values: { [someId]: 50 } };
    useCareerClubStrength(s);
    expect(str(someId)).toBe(50);
  });
});

const row = (
  team: string,
  w: number,
  d: number,
  l: number,
  gf: number,
  ga: number,
): StandingRow => ({
  team,
  p: w + d + l,
  w,
  d,
  l,
  pts: 3 * w + d,
  gf,
  ga,
});

describe('순위표 → 전력 계산', () => {
  const rows = [row('A', 8, 1, 1, 20, 5), row('B', 4, 2, 4, 10, 10), row('C', 1, 1, 8, 5, 20)];
  const map = { A: 'a', B: 'b', C: 'c' };
  const base = { a: 60, b: 63, c: 66 };

  it('맞는 순위표는 통과, 승점·득실 합이 틀리면 이유를 낸다', () => {
    expect(checkStandings(rows)).toEqual([]);
    expect(checkStandings([{ ...rows[0]!, pts: 10 }, ...rows.slice(1)])).toHaveLength(1);
    expect(checkStandings([...rows, rows[0]!]).some((e) => e.includes('두 번'))).toBe(true);
  });

  it('잘한 팀은 오르고 못한 팀은 내려가되 한 번에 ±3, 기본에서 ±6까지만', () => {
    const out = computeStrength(63, rows, map, base, {});
    const by = Object.fromEntries(out.map((r) => [r.id, r.next]));
    expect(by).toEqual({ a: 63, b: 63, c: 63 });
    const again = computeStrength(63, rows, map, base, by);
    expect(Object.fromEntries(again.map((r) => [r.id, r.next]))).toEqual({ a: 66, b: 63, c: 60 });
  });

  it('같은 입력이면 같은 값, 경기 수가 적으면 이전 값 유지, 대응하지 않는 팀은 빠진다', () => {
    expect(computeStrength(63, rows, map, base, {})).toEqual(
      computeStrength(63, rows, map, base, {}),
    );
    const few = computeStrength(63, [row('A', 1, 0, 0, 2, 0), row('Z', 0, 0, 1, 0, 2)], map, base, {
      a: 61,
    });
    expect(few).toEqual([
      { id: 'a', team: 'A', base: 60, prev: 61, target: 61, next: 61, note: '1경기' },
    ]);
  });
});
