// SCR-029 일정표 구역: `season.schedule`을 `season.matches`와 합쳐 화면 행으로 만드는 순수 함수
// (단위 테스트). matchId는 `${season.index}-${entry.step}-${entry.order}`(match.ts)로 파생되지만,
// 여기서는 그 문자열을 다시 만들지 않고 같은 (step, order) 쌍으로 직접 대조한다.
import {
  findLeague,
  resolveOpponent,
  type FootballSeason,
  type MatchAppearance,
  type MatchRecord,
  type Ruleset,
  type ScheduleEntry,
} from '@offside/domain';
import { CUP_ROUND_LABEL_KO, MATCH_APPEARANCE_LABEL_KO, OUT_REASON_LABEL_KO } from './labels.js';
import { opponentDisplayName } from './competition-labels.js';

export type ScheduleRowMatch = {
  scoreText: string;
  outcome: 'WIN' | 'DRAW' | 'LOSS';
  appearanceLabel: string;
  minutes: number;
  ratingText: string;
};

export type ScheduleRow = {
  step: number;
  /** 같은 step에 리그·컵이 겹칠 수 있어(order) 화면 목록 key는 (step, order) 쌍으로 만든다. */
  order: number;
  competitionLabel: string;
  opponentName: string;
  home: boolean;
  eliminated: boolean;
  match: ScheduleRowMatch | null;
};

function findMatch(matches: readonly MatchRecord[], entry: ScheduleEntry): MatchRecord | undefined {
  return matches.find((candidate) => candidate.step === entry.step && candidate.order === entry.order);
}

function appearanceLabel(appearance: MatchAppearance, outReason: MatchRecord['outReason']): string {
  if (outReason === 'UNUSED_SUB') return OUT_REASON_LABEL_KO.UNUSED_SUB;
  if (appearance !== 'OUT' || outReason === null) return MATCH_APPEARANCE_LABEL_KO[appearance];
  return OUT_REASON_LABEL_KO[outReason];
}

function competitionLabel(entry: ScheduleEntry): string {
  if (entry.kind === 'LEAGUE') return '리그';
  if (entry.round === null) return '컵';
  const label = (CUP_ROUND_LABEL_KO as Record<string, string | undefined>)[entry.round];
  return label === undefined ? '컵' : `컵 · ${label}`;
}

/** ratingTenths(정수 ×10)를 소수 1자리 문자열로, null이면 "—"(SCR-029 인수 조건: 미집계 구분). */
export function ratingText(ratingTenths: number | null): string {
  return ratingTenths === null ? '—' : (ratingTenths / 10).toFixed(1);
}

export function buildScheduleRows(season: FootballSeason, ruleset: Ruleset): ScheduleRow[] {
  const team = ruleset.teams.find((candidate) => candidate.id === season.teamId);
  if (team === undefined) {
    throw new RangeError(`buildScheduleRows: 룰셋에 teamId '${season.teamId}'가 없다.`);
  }
  const league = findLeague(ruleset, team.leagueId);

  return season.schedule.map((entry) => {
    const label = competitionLabel(entry);
    if (entry.skipped === 'ELIMINATED') {
      return { step: entry.step, order: entry.order, competitionLabel: label, opponentName: '탈락', home: entry.home, eliminated: true, match: null };
    }

    const opponent = resolveOpponent(ruleset, league, entry.opponentId);
    const match = findMatch(season.matches, entry);

    return {
      step: entry.step,
      order: entry.order,
      competitionLabel: label,
      opponentName: opponentDisplayName(opponent, ruleset),
      home: entry.home,
      eliminated: false,
      match:
        match === undefined
          ? null
          : {
              scoreText: `${match.result.goalsFor}:${match.result.goalsAgainst}`,
              outcome: match.result.outcome,
              appearanceLabel: appearanceLabel(match.appearance, match.outReason),
              minutes: match.minutes,
              ratingText: ratingText(match.ratingTenths),
            },
    };
  });
}
