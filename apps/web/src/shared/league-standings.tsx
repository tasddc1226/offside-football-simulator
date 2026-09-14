import type { StandingRow } from '@offside/domain';
import { resolveTeamName, type TeamNameOverrides } from './team-names.js';
import type { Ruleset } from '@offside/domain';

export function leagueStandingSummary(rows: readonly StandingRow[], teamId: string): string {
  const own = rows.find((row) => row.teamId === teamId);
  if (own === undefined) return '순위 기록을 확인할 수 없습니다.';
  if (own.played === 0) return '시즌 시작 전';
  const above = own.rank <= 1 ? undefined : rows.find((row) => row.rank === own.rank - 1);
  return above === undefined
    ? `${own.rank}위 / ${rows.length}팀 · 현재 선두`
    : `${own.rank}위 / ${rows.length}팀 · ${above.rank}위와 승점 ${above.points - own.points}점 차`;
}

export function LeagueStandingsTable({
  rows,
  teamId,
  leagueName,
  completedRounds,
  ruleset,
  teamNameOverrides,
  promotionSpots,
  relegationSpots,
  final = false,
}: {
  rows: readonly StandingRow[];
  teamId: string;
  leagueName: string;
  completedRounds: number;
  ruleset: Ruleset;
  teamNameOverrides: TeamNameOverrides;
  promotionSpots: number;
  relegationSpots: number;
  final?: boolean;
}) {
  const hasZones = promotionSpots > 0 || relegationSpots > 0;
  return (
    <section className="flex flex-col gap-os-2" aria-label={`${leagueName} ${final ? '최종 ' : ''}순위표`}>
      <div className="flex flex-wrap items-baseline justify-between gap-os-2">
        <h3 className="font-os font-semibold text-os-text">{leagueName} {final ? '최종 순위' : '현재 순위'}</h3>
        <p className="os-num font-os text-os-text-2 text-sm">{completedRounds}라운드 확정</p>
      </div>
      <p className="font-os text-os-text-2 text-sm">{leagueStandingSummary(rows, teamId)}</p>
      <div className="overflow-x-auto rounded-os-m border border-os-border" tabIndex={0} aria-label={`${leagueName} 순위표 가로 스크롤`}>
        <table className="w-full min-w-[36rem] border-collapse font-os text-sm text-os-text">
          <thead className="bg-os-surface-2 text-os-text-2">
            <tr>
              <th scope="col" className="px-os-2 py-os-2 text-right">순위</th>
              <th scope="col" className="px-os-2 py-os-2 text-left">팀</th>
              <th scope="col" className="px-os-2 py-os-2 text-right">경기</th>
              <th scope="col" className="px-os-2 py-os-2 text-right">승</th>
              <th scope="col" className="px-os-2 py-os-2 text-right">무</th>
              <th scope="col" className="px-os-2 py-os-2 text-right">패</th>
              <th scope="col" className="px-os-2 py-os-2 text-right">득점</th>
              <th scope="col" className="px-os-2 py-os-2 text-right">실점</th>
              <th scope="col" className="px-os-2 py-os-2 text-right">득실</th>
              <th scope="col" className="px-os-2 py-os-2 text-right">승점</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const own = row.teamId === teamId;
              const zone = promotionSpots > 0 && row.rank <= promotionSpots
                ? '승격권'
                : relegationSpots > 0 && row.rank > rows.length - relegationSpots
                  ? '강등권'
                  : null;
              return (
                <tr
                  key={row.teamId}
                  className={`border-t border-os-border ${own ? 'font-semibold' : ''}`}
                  style={own ? { background: 'var(--os-accent-soft)' } : undefined}
                  aria-current={own ? 'true' : undefined}
                >
                  <td className="os-num px-os-2 py-os-2 text-right">{row.rank}</td>
                  <th scope="row" className="whitespace-nowrap px-os-2 py-os-2 text-left">
                    {final
                      ? (teamNameOverrides[row.teamId] ?? row.teamName)
                      : (resolveTeamName(ruleset, row.teamId, teamNameOverrides) ?? row.teamName)}
                    {own ? <span className="ml-os-1 text-os-accent">내 팀</span> : null}
                    {zone ? <span className="ml-os-1 font-normal text-os-text-2">{zone}</span> : null}
                  </th>
                  <td className="os-num px-os-2 py-os-2 text-right">{row.played}</td>
                  <td className="os-num px-os-2 py-os-2 text-right">{row.won}</td>
                  <td className="os-num px-os-2 py-os-2 text-right">{row.drawn}</td>
                  <td className="os-num px-os-2 py-os-2 text-right">{row.lost}</td>
                  <td className="os-num px-os-2 py-os-2 text-right">{row.goalsFor}</td>
                  <td className="os-num px-os-2 py-os-2 text-right">{row.goalsAgainst}</td>
                  <td className="os-num px-os-2 py-os-2 text-right">{row.goalDifference > 0 ? '+' : ''}{row.goalDifference}</td>
                  <td className="os-num px-os-2 py-os-2 text-right font-semibold">{row.points}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {hasZones ? (
        <p className="font-os text-os-text-2 text-sm">승격·강등권은 순위 기준 구간이며 다음 시즌 리그 이동은 지원하지 않습니다.</p>
      ) : null}
    </section>
  );
}
