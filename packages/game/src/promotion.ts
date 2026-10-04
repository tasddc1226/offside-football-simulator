// ───────── K리그2 우승 구단의 K리그1 승격 (T-10-110) ─────────
// 시즌 최종 1위(endSeason의 rank — 'K리그2 우승'과 같은 판정)로 K2를 마친 내 구단은 다음 시즌 K1에서 뛴다.
// 두 리그의 팀 수는 그대로다: K1에서 기본 전력이 가장 낮은 구단(동률은 id 순)이 K2로 내려간다. 승강은 이
// 커리어 안에서만 이어지고(s.leagueMoves), 정적 CLUBS·다른 커리어·서버 기록에는 번지지 않는다. 난수를 쓰지 않는다.
// 기획: docs/tracking/k2-promotion-plan.md
import { CLUBS, clubRef, sameClub, type Club } from './data.js';
import { clubsIn, leagueOf } from './player.js';
import { log } from './stats.js';
import type { GameState } from './types.js';

export interface Promotion {
  /** 승격한 내 구단 이름. */
  club: string;
  /** 자리를 내주고 K2로 내려간 구단 이름. */
  down: string;
}

/** K1에서 내려갈 구단 — 기본 전력이 가장 낮은 구단, 동률은 id 순. */
const weakestK1 = (s: GameState): Club =>
  clubsIn('k1', s).sort((a, b) => a.str - b.str || a.id.localeCompare(b.id))[0]!;

/** 정적 소속으로 돌아오면 표에서 뺀다(표에는 옮겨 간 구단만). */
function setMove(moves: Record<string, string>, c: Club, to: string) {
  if (c.leagueId === to) delete moves[c.id];
  else moves[c.id] = to;
}

/** 이번 시즌 최종 순위로 승격을 확정한다. endSeason이 기록을 남긴 뒤 한 번 부른다. */
export function promoteClub(s: GameState, rank: number): Promotion | undefined {
  if (rank !== 1 || s.leagueId !== 'k2') return;
  const me = CLUBS.find((c) => c.id === s.club.id)!;
  const down = weakestK1(s);
  const moves = (s.leagueMoves ??= {});
  setMove(moves, me, 'k1');
  setMove(moves, down, 'k2');
  s.season.leagueId = s.leagueId;
  s.leagueId = 'k1';
  const k1 = leagueOf('k1').name;
  log(s, `${s.club.name} ${k1} 승격 확정! 다음 시즌은 ${k1}에서 뜁니다 (${down.name} 강등)`, 'big');
  return { club: s.club.name, down: down.name };
}

/** 지난 시즌과 같은 구단인데 리그가 달라졌다 = 구단과 함께 방금 승격했다(이적 시장 안내). */
export function movedWithClub(s: GameState): boolean {
  const last = s.career[s.career.length - 1];
  return !!last && sameClub(last, clubRef(s.club)) && last.league !== leagueOf(s.leagueId).name;
}
