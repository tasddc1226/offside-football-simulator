import { seasonWonTitle, type CareerState, type Ruleset } from '@offside/domain';
import { seasonYearLabel } from './season-year.js';

export type CareerSeasonNarrative = {
  id: string;
  seasonIndex: number;
  year: string;
  teamName: string;
  status: 'COMPLETED' | 'ONGOING';
  sentence: string;
  facts: readonly string[];
};

function teamNameForSeason(
  state: CareerState,
  ruleset: Ruleset,
  seasonIndex: number,
  teamId: string,
): string {
  const stint = state.clubHistory
    .filter(
      (candidate) =>
        candidate.teamId === teamId &&
        candidate.fromSeasonIndex <= seasonIndex &&
        (candidate.toSeasonIndex === null || candidate.toSeasonIndex >= seasonIndex),
    )
    .at(-1);
  return (
    stint?.teamName ?? ruleset.teams.find((team) => team.id === teamId)?.name ?? '소속 팀 기록 없음'
  );
}

function transferFact(state: CareerState, seasonIndex: number): string | null {
  const stint = state.clubHistory.find((candidate) => candidate.fromSeasonIndex === seasonIndex);
  if (stint === undefined || seasonIndex === 1) return null;
  return stint.kind === 'LOAN' ? '임대 소속으로 시작' : '새 소속에서 시작';
}

function completedNarrative(
  state: CareerState,
  ruleset: Ruleset,
  season: CareerState['seasonHistory'][number],
  startYear: number,
): CareerSeasonNarrative {
  const played =
    season.result.playerStats.appearances.total - season.result.playerStats.appearances.zeroMinute;
  const facts: string[] = [
    `${played}경기 출전`,
    `${season.result.playerStats.minutes.toLocaleString('ko-KR')}분`,
  ];
  if (season.result.playerStats.ratedMatches > 0) {
    facts.push(
      `평균 평점 ${(season.result.playerStats.ratingSumTenths / season.result.playerStats.ratedMatches / 10).toFixed(1)}`,
    );
  }
  const titleCount = season.result.competitions.filter((competition) =>
    seasonWonTitle({ competitions: [competition] }),
  ).length;
  if (titleCount > 0) facts.push(`우승 ${titleCount}개`);
  if (season.result.playerStats.injuries > 0)
    facts.push(`부상 기록 ${season.result.playerStats.injuries}회`);
  if (season.result.baseOvr.after !== season.result.baseOvr.before) {
    facts.push(`OVR ${season.result.baseOvr.before}→${season.result.baseOvr.after}`);
  }
  const transfer = transferFact(state, season.index);
  if (transfer !== null) facts.push(transfer);
  const teamName = teamNameForSeason(state, ruleset, season.index, season.teamId);
  return {
    id: `season-${season.index}`,
    seasonIndex: season.index,
    year: seasonYearLabel(startYear, season.index),
    teamName,
    status: 'COMPLETED',
    sentence: `${seasonYearLabel(startYear, season.index)} · ${teamName} — ${facts.join(' · ')}`,
    facts,
  };
}

/** Build deterministic yearly copy from persisted records only. No probabilities or inferred events. */
export function buildCareerSeasonNarratives(
  state: CareerState,
  ruleset: Ruleset,
  startYear: number,
): CareerSeasonNarrative[] {
  const completed = state.seasonHistory.map((season) =>
    completedNarrative(state, ruleset, season, startYear),
  );
  if (state.season === null) return completed;
  const teamName = teamNameForSeason(state, ruleset, state.season.index, state.season.teamId);
  const year = seasonYearLabel(startYear, state.season.index);
  return [
    ...completed,
    {
      id: `season-${state.season.index}-ongoing`,
      seasonIndex: state.season.index,
      year,
      teamName,
      status: 'ONGOING',
      sentence: `${year} · ${teamName} — 시즌 진행 중 · 결산 전 확정 기록 없음`,
      facts: ['시즌 진행 중', '결산 전 확정 기록 없음'],
    },
  ];
}
