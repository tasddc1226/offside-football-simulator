import type { TeamMatch, TeamMoment } from '@offside/contracts';
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
  type StoredMomentView,
  type TeamMatchRow,
} from '../db/repos/ownerTeams.js';
import type { Lang } from '../lang.js';
import { anonText } from './anon.js';
import type { MomentActor } from './moments.js';
import {
  buildLineup,
  lineupOvr,
  type MatchCoach,
  type PlayerRef,
  type SideReport,
  type SimResult,
} from './sim.js';
import { coachesByIds } from '../db/repos/managers.js';

// 랭크 경기(T-10-092)와 친선전(T-11-098)이 함께 쓰는 경기 한 판 준비 · 저장할 상세 · 화면 모양 변환.

export type MatchHead = Pick<
  TeamMatchRow,
  'id' | 'homeTeamId' | 'homeGoals' | 'awayGoals' | 'createdAt'
>;

/**
 * 두 팀(그 시즌)의 선발. 각 팀은 자기 구단주의 그 시즌 은퇴 선수만 뛴다. T-11-310 감독 칸의 감독도 함께 읽는다(그 팀
 * 구단주가 끝낸 감독만). 쿼리 2번(나란히).
 */
export async function lineupsOf(db: Db, season: number, home: OwnerTeamRow, away: OwnerTeamRow) {
  const homeSlots = slotIdsOf(home);
  const awaySlots = slotIdsOf(away);
  const [rows, coachRows] = await Promise.all([
    careersByIds(db, [
      ...new Set([...homeSlots, ...awaySlots].filter((x): x is string => x !== null)),
    ]),
    coachesByIds(db, [home.coachId, away.coachId]),
  ]);
  const coach = (t: OwnerTeamRow): MatchCoach => {
    const c = t.coachId ? coachRows.get(t.coachId) : undefined;
    return c && c.profileId === t.profileId
      ? { card: c, formation: t.formation as FormationId }
      : null;
  };
  const lineup = (t: OwnerTeamRow, slots: typeof homeSlots) =>
    buildLineup(
      t.formation as FormationId,
      slots,
      eligibleMap(rows, t.profileId, season, true),
      layoutOf(t),
    );
  return {
    home: lineup(home, homeSlots),
    away: lineup(away, awaySlots),
    coaches: { home: coach(home), away: coach(away) },
  };
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
  const side = (
    t: OwnerTeamRow,
    lineup: Lineups['home'],
    change: number | undefined,
    synergy: string[] | undefined,
    report: SideReport,
  ) => ({
    teamId: t.id,
    name: t.name,
    owner: t.manager,
    formation: t.formation as FormationId,
    ovr: lineupOvr(lineup),
    ...(change === undefined ? {} : { ratingChange: change }),
    ...(synergy === undefined ? {} : { synergy }),
    xg: Math.round(report.xg * 10) / 10,
    lines: {
      atk: Math.round(report.lines.atk),
      mid: Math.round(report.lines.mid),
      def: Math.round(report.lines.def),
      gk: Math.round(report.lines.gk),
    },
  });
  return {
    home: side(home, lineups.home, delta?.home, result.synergy?.home, result.report.home),
    away: side(away, lineups.away, delta?.away, result.synergy?.away, result.report.away),
    events: result.events.map(storedEvent),
  };
}

export const storedEvent = (e: SimResult['events'][number]): MatchDetail['events'][number] => ({
  minute: e.minute,
  side: e.side,
  scorer: e.scorer,
  assist: e.assist,
  slot: e.slot,
});

export function toMatch(
  row: MatchHead,
  d: MatchDetail,
  myTeamId: string,
  names: ReadonlyMap<string, string>,
  logos: ReadonlyMap<string, ReturnType<typeof logoOf>>,
  lang: Lang = 'ko',
): TeamMatch {
  const anon = (p: PlayerRef) => anonText(p.anon, lang);
  const label = (p: PlayerRef) => (p.careerId ? (names.get(p.careerId) ?? anon(p)) : anon(p));
  const mine = row.homeTeamId === myTeamId ? 'home' : 'away';
  // 저장된 시너지 ID는 내부 경기 기록이다. 구버전 앱도 읽는 공개 응답에는 계약 필드만 보낸다.
  const publicSide = (side: MatchDetail['home']) => ({
    teamId: side.teamId,
    name: side.name,
    owner: side.owner,
    formation: side.formation,
    ovr: side.ovr,
    ...(side.xg === undefined ? {} : { xg: side.xg }),
    ...(side.lines === undefined ? {} : { lines: side.lines }),
  });
  return {
    id: row.id,
    home: {
      ...publicSide(d.home),
      logo: logos.get(d.home.teamId) ?? null,
      goals: row.homeGoals,
      ratingChange: d.home.ratingChange ?? null,
    },
    away: {
      ...publicSide(d.away),
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
      ...(e.slot ? { slot: e.slot } : {}),
    })),
    mine,
    ...(d.moments?.length
      ? { moments: d.moments.map((m, i) => momentView(m, i, mine === 'home', label)) }
      : {}),
    createdAt: row.createdAt,
  };
}

/** 장면 하나를 화면 모양으로. 장면은 늘 경기를 건 쪽(home)의 것이라, 조회한 쪽이 home일 때만 커리어 id를 준다. */
export function momentView(
  m: StoredMomentView,
  index: number,
  mineIsHome: boolean,
  label: (p: PlayerRef) => string,
): TeamMoment {
  const who = (a: MomentActor, mineSide: boolean) => ({
    name: label(a.ref),
    id: mineSide ? a.ref.careerId : null,
    slot: a.slot,
  });
  return {
    index,
    minute: m.minute,
    kind: m.kind,
    situation: m.situation,
    actor: who(m.actor, mineIsHome),
    mate: who(m.mate, mineIsHome),
    opp: who(m.opp, !mineIsHome),
    choices: m.choices.map((c) => ({
      id: c.id,
      pct: c.pct,
      mate: c.mate,
      risk: Math.round(c.risk * 100),
      gain: Math.round(c.gain * 100),
    })),
    ...(m.picked === undefined ? {} : { picked: m.picked, ok: !!m.ok }),
  };
}

/** 방금 치른 경기(내 팀이 홈)를 화면 모양으로. 이름은 선발 명단의 공개 이름이라 쿼리가 없다. */
export function playedMatch(
  head: MatchHead,
  detail: MatchDetail,
  lineups: Lineups,
  home: OwnerTeamRow,
  away: OwnerTeamRow,
  lang: Lang = 'ko',
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
    lang,
  );
}

const careerIdsIn = (details: readonly MatchDetail[]) => [
  ...new Set(
    details.flatMap((d) =>
      [
        ...d.events.flatMap((e) => [e.scorer.careerId, e.assist?.careerId]),
        ...(d.moments ?? []).flatMap((m) => [m.actor, m.mate, m.opp].map((a) => a.ref.careerId)),
      ].filter((x): x is string => !!x),
    ),
  ),
];

/** 저장된 경기들을 화면 모양으로. 선수 이름은 지금 공개 이름, 로고는 지금 팀 로고로 붙인다. 쿼리 2번(병렬). */
export async function matchViews<R extends MatchHead & { detailJson: string }>(
  db: Db,
  rows: readonly R[],
  myTeamIdOf: (row: R) => string,
  lang: Lang = 'ko',
): Promise<TeamMatch[]> {
  const details = rows.map((r) => JSON.parse(r.detailJson) as MatchDetail);
  const [names, logos] = await Promise.all([
    publicNamesOf(db, careerIdsIn(details)),
    teamLogosByIds(
      db,
      details.flatMap((d) => [d.home.teamId, d.away.teamId]),
    ),
  ]);
  return rows.map((r, i) => toMatch(r, details[i]!, myTeamIdOf(r), names, logos, lang));
}

/** 경기를 받은 구단주에게 보내는 알림(랭크 경기 · 장면 경기 마감). */
export const matchNotice = (
  id: string,
  home: Pick<OwnerTeamRow, 'name'>,
  away: Pick<OwnerTeamRow, 'name' | 'profileId'>,
  homeGoals: number,
  awayGoals: number,
  now: string,
) => ({
  profileId: away.profileId,
  sourceKey: `team-match:${id}`,
  now,
  content: {
    kind: 'team' as const,
    title: '내 팀에 새 경기 결과가 있어요',
    body: `${away.name} ${awayGoals} : ${homeGoals} ${home.name}. 최근 경기에서 결과를 확인해 주세요.`,
    target: { type: 'screen' as const, screen: 'team' as const },
  },
});
