// UX-014 "우승 연혁" 탭(대시보드 4번째 탭): 시즌별 결산 기록(`state.seasonHistory[].result.competitions`)
// 에서 리그 1위(우승)·컵 우승(cupRound === 'WON')만 골라 보여준다. 커리어 레거시 서사(성취·기여·
// 장기성 등 LegacyScoreCard)는 은퇴 시점에만 계산되는 별도 결과라 여기서는 다루지 않는다 — 진행 중
// 커리어에서도 바로 확인할 수 있는 "우승·컵" 실적만 다룬다(PR 본문 한계 참고).
import { seasonWonTitle, type CareerState, type CompetitionRecord, type Ruleset } from '@offside/domain';

export type TrophyEntry = {
  id: string;
  seasonNumber: number;
  teamId: string;
  /** 예: "1부 리그 우승" · "FA컵 우승". */
  label: string;
  historyIndex: number;
};

function trophyLabel(record: CompetitionRecord, ruleset: Ruleset, teamId: string): string | null {
  // PR 231 리뷰: "우승" 판정 자체는 여기서 다시 만들지 않는다 — 결산 평판(packages/domain
  // reputation.ts)·은퇴 화면(retirement-screen.tsx)과 똑같이 seasonWonTitle을 재사용해 세 곳의
  // "우승" 기준이 갈라지지 않게 한다(레코드 하나만 담아 그 레코드 단독으로 우승인지만 묻는다,
  // retirement-screen.tsx와 같은 패턴).
  if (!seasonWonTitle({ competitions: [record] })) return null;
  const team = ruleset.teams.find((candidate) => candidate.id === teamId);
  if (record.kind === 'LEAGUE') {
    const league =
      team === undefined
        ? undefined
        : ruleset.leagues.find((candidate) => candidate.id === team.leagueId);
    return `${league?.name ?? '리그'} 우승`;
  }
  const cup =
    team === undefined
      ? undefined
      : ruleset.cups.find((candidate) => candidate.tiers.includes(team.leagueTier));
  return `${cup?.name ?? '컵'} 우승`;
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
