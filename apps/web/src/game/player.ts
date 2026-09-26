// ───────── 선수·리그 조회와 파생 값 (T-10-046: engine.ts에서 분리) ─────────
import {
  LEAGUES,
  CLUBS,
  focusOfType,
  attrLabels,
  type AttrKey,
  type League,
  type Club,
} from './data.js';
import { ovr } from './attributes.js';
import type { GameState } from './types.js';

export const leagueOf = (id: string): League => LEAGUES.find((l) => l.id === id)!;
export const clubsIn = (id: string): Club[] => CLUBS.filter((c) => c.leagueId === id);
/** 주력 능력치 — 옛 저장본(focus 없음)은 유형에서 거꾸로 구한다. */
export const focusOf = (s: GameState): AttrKey[] => s.focus ?? focusOfType(s.pos, s.type);
export const labelOf = (s: GameState, k: AttrKey): string => attrLabels(s.pos)[k];
export function roleOf(s: GameState): '주전' | '로테이션' | '벤치' {
  if (leagueOf(s.leagueId).amateur)
    return ovr(s) >= s.club.str - 2 ? '주전' : ovr(s) >= s.club.str - 8 ? '로테이션' : '벤치';
  const d = ovr(s) - s.club.str + s.trust;
  return d >= 1 ? '주전' : d >= -5 ? '로테이션' : '벤치';
}
export function salaryFor(leagueId: string, o: number): number {
  const L = leagueOf(leagueId);
  return Math.round((L.wealth * 1000 * Math.exp((o - 60) / 10)) / 10) * 10;
}
export function fmtMoney(man: number): string {
  const m = Math.round(man);
  if (Math.abs(m) >= 10000) {
    // 천만 단위로 먼저 반올림해야 9,770만 → '1억'으로 올라간다('18억 10,000만' 방지). 음수는 부호만 앞에 붙인다.
    const t = Math.round(Math.abs(m) / 1000) * 1000;
    const e = Math.floor(t / 10000),
      r = t % 10000;
    return `${m < 0 ? '-' : ''}${e}억${r ? ` ${r.toLocaleString()}만` : ''}`;
  }
  return `${m.toLocaleString()}만`;
}
