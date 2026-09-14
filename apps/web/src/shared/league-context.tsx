import {
  assertSeasonLeagueLedgerInvariant,
  standingsFromLedger,
  type FootballSeason,
  type Ruleset,
  type StandingRow,
} from '@offside/domain';
import { Link } from '@tanstack/react-router';
import { buttonClassName, buttonStyle } from '@offside/ui';

export type CurrentLeagueContextView = {
  leagueName: string;
  confirmedRound: number;
  ownPlayed: number;
  summary: string;
  hasConfirmedResults: boolean;
};

export function leaguePositionSummary(rows: readonly StandingRow[], teamId: string): string | null {
  const ownIndex = rows.findIndex((row) => row.teamId === teamId);
  const own = rows[ownIndex];
  if (own === undefined) return null;

  const position = `${own.rank}위 / ${rows.length}팀 · ${own.played}경기`;
  if (ownIndex === 0) {
    const below = rows[1];
    if (below === undefined) return position;
    const gap = own.points - below.points;
    return gap === 0
      ? `${position} · ${below.rank}위와 승점 동률`
      : `${position} · ${below.rank}위에 승점 ${gap}점 앞섬`;
  }

  const above = rows[ownIndex - 1];
  if (above === undefined) return position;
  const gap = above.points - own.points;
  return gap === 0
    ? `${position} · ${above.rank}위와 승점 동률`
    : `${position} · ${above.rank}위와 승점 ${gap}점 차`;
}

/**
 * 현재 활성 시즌과 원장의 binding이 온전히 일치할 때만 노출하는 읽기 전용 view model.
 * 구버전·과거 시즌·누락/손상 원장은 UI에서 보정하거나 추측하지 않는다.
 */
export function buildCurrentLeagueContext(
  season: FootballSeason | null,
  ruleset: Ruleset,
): CurrentLeagueContextView | null {
  if (
    season === null ||
    ruleset.leagueLedgerRules === undefined ||
    season.leagueLedger === undefined
  ) {
    return null;
  }

  try {
    assertSeasonLeagueLedgerInvariant(ruleset, season);
    const rows = standingsFromLedger(ruleset, season.leagueLedger);
    const own = rows.find((row) => row.teamId === season.teamId);
    if (own === undefined) return null;

    const confirmedRound = Math.max(0, ...season.leagueLedger.completedRounds);
    if (confirmedRound === 0) {
      return {
        leagueName: season.leagueLedger.leagueName,
        confirmedRound,
        ownPlayed: own.played,
        summary: `${own.played}경기 · 아직 확정된 리그 경기 결과가 없습니다.`,
        hasConfirmedResults: false,
      };
    }

    const summary = leaguePositionSummary(rows, season.teamId);
    if (summary === null) return null;
    return {
      leagueName: season.leagueLedger.leagueName,
      confirmedRound,
      ownPlayed: own.played,
      summary,
      hasConfirmedResults: true,
    };
  } catch {
    return null;
  }
}

export function CurrentLeagueContext({
  careerId,
  view,
}: {
  careerId: string;
  view: CurrentLeagueContextView;
}) {
  return (
    <section className="os-panel flex flex-col gap-os-2" aria-label="현재 팀 리그 상황">
      <div className="flex flex-wrap items-baseline justify-between gap-os-2">
        <p className="os-eyebrow">현재 팀 상황</p>
        <p className="os-num font-os text-os-text-2 text-sm">
          {view.hasConfirmedResults
            ? `이번 시즌 ${view.confirmedRound}라운드 종료 기준`
            : '아직 확정된 경기 없음'}
        </p>
      </div>
      <p className="font-os font-semibold text-os-text">{view.leagueName}</p>
      <p className="os-num font-os text-os-text">{view.summary}</p>
      <p className="font-os text-os-text-2 text-sm">
        확정된 리그 경기만 반영한 현재 팀 상황입니다.
      </p>
      <Link
        to="/career/$careerId"
        params={{ careerId }}
        search={{ view: 'schedule' }}
        className={buttonClassName('secondary')}
        style={buttonStyle}
      >
        순위표 보기
      </Link>
    </section>
  );
}
