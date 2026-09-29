// ───────── K리그2 우승 구단의 K리그1 승격 (T-10-110) ─────────
// 시즌 최종 1위(endSeason의 rank — 'K리그2 우승'과 같은 판정)로 K2를 마친 내 구단은 다음 시즌 K1에서 뛴다.
// 두 리그의 팀 수는 그대로다: K1에서 기본 전력이 가장 낮은 구단(동률은 id 순)이 K2로 내려간다. 승강은 이
// 커리어 안에서만 이어지고(s.leagueMoves), 정적 CLUBS·다른 커리어·서버 기록에는 번지지 않는다. 난수를 쓰지 않는다.
// 기획: docs/tracking/k2-promotion-plan.md
import { CLUBS, clubRef, sameClub, type Club } from './data.js';
import { clubsIn, leagueOf } from './player.js';
import type { GameState } from './types.js';

export interface Promotion {
  /** 승격한 내 구단 이름. */
  club: string;
  /** 올라간 리그 이름(K리그1). */
  league: string;
  /** 자리를 내주고 K2로 내려간 구단 이름. */
  down: string | null;
}

function setMove(moves: Record<string, string>, c: Club, to: string) {
  if (c.leagueId === to) delete moves[c.id];
  else moves[c.id] = to;
}

/** 이번 시즌 최종 순위로 승격을 확정한다. endSeason이 기록을 남긴 뒤 한 번 부른다. */
export function promoteClub(s: GameState, rank: number): Promotion | null {
  if (rank !== 1 || s.leagueId !== 'k2') return null;
  const me = CLUBS.find((c) => c.id === s.club.id);
  if (!me) return null;
  const down =
    clubsIn('k1', s).sort((a, b) => a.str - b.str || a.id.localeCompare(b.id))[0] ?? null;
  const moves = { ...s.leagueMoves };
  setMove(moves, me, 'k1');
  if (down) setMove(moves, down, 'k2');
  s.leagueMoves = moves;
  s.leagueId = 'k1';
  s.club = { ...s.club, leagueId: 'k1' };
  return { club: s.club.name, league: leagueOf('k1').name, down: down?.name ?? null };
}

/** 지난 시즌과 같은 구단인데 리그가 달라졌다 = 구단과 함께 승격했다. 이번 시즌 대륙 대회 자격(지난 리그 순위는
 * 다른 리그의 것)과 이적 시장 안내에 쓴다. */
export function movedWithClub(s: GameState): boolean {
  const last = s.career[s.career.length - 1];
  return !!last && sameClub(last, clubRef(s.club)) && last.league !== leagueOf(s.leagueId).name;
}
