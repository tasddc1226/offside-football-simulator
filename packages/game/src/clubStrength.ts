// ───────── T-11-135 구단 전력표 (T-11-132 2단계) ─────────
// 현실 순위표로 만든 전력(club-strength-data.ts)을 CLUBS.str에 덮는다. 밸런스 설정(balance.ts)과 같은 방식으로
// 커리어마다 버전을 저장하고(GameState.cs), 새 버전은 다음 시즌이 시작될 때(newSeason) 그 커리어에 들어온다 —
// 시즌 도중에는 상대 전력·이적 제안·주전 경쟁이 같은 값을 읽는다. 난수는 쓰지 않는다.
import { DYNAMIC_LEAGUES, type ClubStrengthSnapshot } from '@offside/contracts/club-strength-spec';
import { CLUB_STRENGTH } from './club-strength-data.js';
import { CLUBS } from './data.js';
import type { GameState } from './types.js';

export type CareerClubStrength = { v: number; values: Record<string, number> };

let latest: ClubStrengthSnapshot = CLUB_STRENGTH;
export const latestClubStrength = () => latest;
/** Validate before staging; a stale response/offline restart never rolls a career back. */
export function setLatestClubStrength(value: ClubStrengthSnapshot | null): void {
  if (value === null) {
    latest = CLUB_STRENGTH;
    return;
  }
  if (
    typeof value !== 'object' ||
    !value.values ||
    typeof value.values !== 'object' ||
    Array.isArray(value.values) ||
    !Number.isSafeInteger(value.v) ||
    value.v <= latest.v ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value.asOf)
  )
    return;
  const valid = Object.entries(value.values).every(([id, n]) => {
    const club = CLUBS.find((c) => c.id === id);
    return (
      club &&
      DYNAMIC_LEAGUES.some((l) => l === club.leagueId) &&
      Number.isInteger(n) &&
      n >= 1 &&
      n <= 99
    );
  });
  if (valid) latest = { ...value, values: { ...value.values } };
}

/** data.ts가 정한 기본 전력(전력표 적용 전). */
const BASE_STR = new Map(CLUBS.map((c) => [c.id, c.str]));
export const baseStr = (id: string): number | undefined => BASE_STR.get(id);

/** 전력표를 CLUBS에 덮는다. 표에 없는 구단은 기본 전력으로 돌린다. 같은 객체를 고쳐 clubById 등이 새 값을 본다. */
export function applyClubStrength(values: Record<string, number> = {}): void {
  for (const c of CLUBS)
    c.str =
      (DYNAMIC_LEAGUES.some((l) => l === c.leagueId) ? values[c.id] : undefined) ??
      BASE_STR.get(c.id)!;
}

/** 저장된 커리어를 불러올 때: 그 커리어가 받아들인 전력표로 맞춘다(없으면 기본 전력). */
export function useCareerClubStrength(s: GameState | null): void {
  applyClubStrength(s?.cs?.values);
}

/**
 * 새 시즌 시작 · 새 커리어: 최신 전력표 버전이 다르면 그 커리어에 넣는다. 세이브에 복사해 둔 내 구단 전력도 지금 값으로
 * 맞춘다(같은 구단에 남으면 예전 시즌 값이 남아 있다). 새 버전을 받았으면 true.
 */
export function adoptClubStrength(s: GameState): boolean {
  const next = latest.v > (s.cs?.v ?? 0);
  if (next) s.cs = { v: latest.v, values: { ...latest.values } };
  applyClubStrength(s.cs?.values);
  const mine = CLUBS.find((c) => c.id === s.club.id);
  if (mine) s.club.str = mine.str;
  return next;
}
