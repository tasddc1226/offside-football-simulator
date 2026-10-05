import type { TeamMatch } from '@offside/contracts';
import type { FormationId } from '@offside/contracts/owner-team';
import type { Db } from '../db/client.js';
import {
  careersByIds,
  eligibleMap,
  layoutOf,
  logoOf,
  publicNamesOf,
  slotIdsOf,
  teamLogosByIds,
  type MatchDetail,
  type OwnerTeamRow,
  type TeamMatchRow,
} from '../db/repos/ownerTeams.js';
import { buildLineup, lineupOvr, type PlayerRef, type SimResult } from './sim.js';

// 랭크 경기(T-10-092)와 친선전(T-11-098)이 함께 쓰는 경기 한 판 준비 · 저장할 상세 · 화면 모양 변환.

export type MatchHead = Pick<
  TeamMatchRow,
  'id' | 'homeTeamId' | 'homeGoals' | 'awayGoals' | 'createdAt'
>;

/** 두 팀(그 시즌)의 선발. 각 팀은 자기 구단주의 그 시즌 은퇴 선수만 뛴다. 쿼리 1번. */
export async function lineupsOf(db: Db, season: number, home: OwnerTeamRow, away: OwnerTeamRow) {
  const homeSlots = slotIdsOf(home);
  const awaySlots = slotIdsOf(away);
  const rows = await careersByIds(db, [
    ...new Set([...homeSlots, ...awaySlots].filter((x): x is string => x !== null)),
  ]);
  const lineup = (t: OwnerTeamRow, slots: typeof homeSlots) =>
    buildLineup(
      t.formation as FormationId,
      slots,
      eligibleMap(rows, t.profileId, season, true),
      layoutOf(t),
    );
  return { home: lineup(home, homeSlots), away: lineup(away, awaySlots) };
}

export type Lineups = Awaited<ReturnType<typeof lineupsOf>>;

/** 저장할 경기 상세(이벤트는 선수 참조 그대로). 랭크 경기는 레이팅 변화를 함께 적는다. */
export function matchDetailOf(
  home: OwnerTeamRow,
  away: OwnerTeamRow,
  lineups: Lineups,
  result: SimResult,
  delta?: { home: number; away: number },
): MatchDetail {
  const side = (t: OwnerTeamRow, lineup: Lineups['home'], change: number | undefined) => ({
    teamId: t.id,
    name: t.name,
    owner: t.manager,
    formation: t.formation as FormationId,
    ovr: lineupOvr(lineup),
    ...(change === undefined ? {} : { ratingChange: change }),
  });
  return {
    home: side(home, lineups.home, delta?.home),
    away: side(away, lineups.away, delta?.away),
    events: result.events.map((e) => ({
      minute: e.minute,
      side: e.side,
      scorer: e.scorer,
      assist: e.assist,
    })),
  };
}

export function toMatch(
  row: MatchHead,
  d: MatchDetail,
  myTeamId: string,
  names: ReadonlyMap<string, string>,
  logos: ReadonlyMap<string, ReturnType<typeof logoOf>>,
): TeamMatch {
  const label = (p: PlayerRef) => (p.careerId ? (names.get(p.careerId) ?? p.anon) : p.anon);
  const mine = row.homeTeamId === myTeamId ? 'home' : 'away';
  return {
    id: row.id,
    home: {
      ...d.home,
      logo: logos.get(d.home.teamId) ?? null,
      goals: row.homeGoals,
      ratingChange: d.home.ratingChange ?? null,
    },
    away: {
      ...d.away,
      logo: logos.get(d.away.teamId) ?? null,
      goals: row.awayGoals,
      ratingChange: d.away.ratingChange ?? null,
    },
    events: d.events.map((e) => ({
      minute: e.minute,
      side: e.side,
      scorer: label(e.scorer),
      assist: e.assist ? label(e.assist) : null,
      scorerId: e.side === mine ? e.scorer.careerId : null,
      assistId: e.side === mine ? (e.assist?.careerId ?? null) : null,
    })),
    mine,
    createdAt: row.createdAt,
  };
}

/** 방금 치른 경기(내 팀이 홈)를 화면 모양으로. 이름은 선발 명단의 공개 이름이라 쿼리가 없다. */
export function playedMatch(
  head: MatchHead,
  detail: MatchDetail,
  lineups: Lineups,
  home: OwnerTeamRow,
  away: OwnerTeamRow,
): TeamMatch {
  const names = new Map<string, string>();
  for (const s of [...lineups.home, ...lineups.away])
    if (s.careerId && s.publicName) names.set(s.careerId, s.publicName);
  return toMatch(
    head,
    detail,
    home.id,
    names,
    new Map([
      [home.id, logoOf(home)],
      [away.id, logoOf(away)],
    ]),
  );
}

const careerIdsIn = (details: readonly MatchDetail[]) => [
  ...new Set(
    details.flatMap((d) =>
      d.events.flatMap((e) =>
        [e.scorer.careerId, e.assist?.careerId].filter((x): x is string => !!x),
      ),
    ),
  ),
];

/** 저장된 경기들을 화면 모양으로. 선수 이름은 지금 공개 이름, 로고는 지금 팀 로고로 붙인다. 쿼리 2번(병렬). */
export async function matchViews<R extends MatchHead & { detailJson: string }>(
  db: Db,
  rows: readonly R[],
  myTeamIdOf: (row: R) => string,
): Promise<TeamMatch[]> {
  const details = rows.map((r) => JSON.parse(r.detailJson) as MatchDetail);
  const [names, logos] = await Promise.all([
    publicNamesOf(db, careerIdsIn(details)),
    teamLogosByIds(
      db,
      details.flatMap((d) => [d.home.teamId, d.away.teamId]),
    ),
  ]);
  return rows.map((r, i) => toMatch(r, details[i]!, myTeamIdOf(r), names, logos));
}
