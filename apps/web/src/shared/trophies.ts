// UX-014 "우승 연혁" 탭(대시보드 4번째 탭): 시즌별 결산 기록(`state.seasonHistory[].result.competitions`)
// 에서 리그 1위(우승)·컵 우승(cupRound === 'WON')만 골라 보여준다. 커리어 레거시 서사(성취·기여·
// 장기성 등 LegacyScoreCard)는 은퇴 시점에만 계산되는 별도 결과라 여기서는 다루지 않는다 — 진행 중
// 커리어에서도 바로 확인할 수 있는 "우승·컵" 실적만 다룬다(PR 본문 한계 참고).
import type { CareerState, CompetitionRecord, Ruleset } from '@offside/domain';

export type TrophyEntry = {
  id: string;
  seasonNumber: number;
  teamId: string;
  /** 예: "1부 리그 우승" · "FA컵 우승". */
  label: string;
  historyIndex: number;
};

function trophyLabel(record: CompetitionRecord, ruleset: Ruleset, teamId: string): string | null {
  const team = ruleset.teams.find((candidate) => candidate.id === teamId);
  if (record.kind === 'LEAGUE' && record.position === 1) {
    const league =
      team === undefined
        ? undefined
        : ruleset.leagues.find((candidate) => candidate.id === team.leagueId);
    return `${league?.name ?? '리그'} 우승`;
  }
  if (record.kind === 'CUP' && record.cupRound === 'WON') {
    const cup =
      team === undefined
        ? undefined
        : ruleset.cups.find((candidate) => candidate.tiers.includes(team.leagueTier));
    return `${cup?.name ?? '컵'} 우승`;
  }
  return null;
}

/** 최신 시즌이 먼저 오도록 뒤집는다(다이어리·지난 시즌 목록과 같은 관례). */
export function buildTrophyList(state: CareerState, ruleset: Ruleset): TrophyEntry[] {
  const entries: TrophyEntry[] = [];
  state.seasonHistory.forEach((summary, historyIndex) => {
    summary.result.competitions.forEach((record) => {
      const label = trophyLabel(record, ruleset, summary.teamId);
      if (label === null) return;
      entries.push({
        id: `${historyIndex}-${record.competitionId}`,
        seasonNumber: summary.index,
        teamId: summary.teamId,
        label,
        historyIndex,
      });
    });
  });
  return entries.reverse();
}
