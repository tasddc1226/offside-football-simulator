// T-11-387 장면 경기 시작 · 장면 판정 · 마감. 랭크 경기 라우트(routes/ownerTeam.ts)와 5분 cron(마감 안 된 경기 정리)이 같이 쓴다.
import type { PlayTeamMatchResponse, TeamMatchEvent } from '@offside/contracts';
import { MOMENT_RULES } from '@offside/contracts/team-moments';
import { matchScore, ratingChange } from '@offside/contracts/owner-team';
import type { Db } from '../db/client.js';
import {
  logoOf,
  recordMatchStatements,
  type OwnerTeamRow,
  type StoredMomentView,
  type TeamSnapshot,
} from '../db/repos/ownerTeams.js';
import {
  liveById,
  markLiveDone,
  purgeDoneLive,
  staleLive,
  teamsForLive,
  type TeamLiveRow,
} from '../db/repos/teamLive.js';
import { commitNotifiedEvent } from '../push/events.js';
import type { Lang } from '../lang.js';
import { anonText } from './anon.js';
import { refreshAfterChange } from './ownerAchievements.js';
import { matchNotice, momentView, storedEvent, toMatch, type Lineups } from './match.js';
import {
  finishMoments,
  liveEvents,
  liveResult,
  type LiveState,
  type StoredMoment,
} from './moments.js';
import type { PlayerRef } from './sim.js';

/** team_live_matches.state_json. 마감에 필요한 것을 시작할 때 모두 적어 둔다(선발이 그 사이에 바뀌어도 같은 경기다). */
export type LivePayload = {
  v: 1;
  /** 팀 시즌(마감 뒤 구단주 점수를 다시 셀 시즌). */
  season: number;
  state: LiveState;
  /** 두 팀 스냅샷(레이팅 변화는 마감 때 붙인다). */
  snap: { home: TeamSnapshot; away: TeamSnapshot };
  filled: { home: number; away: number };
  /** 최근 같은 상대를 만난 횟수(레이팅 변화를 줄인다). */
  met: number;
  /** 선발의 공개 이름(커리어 id → 이름). */
  names: Record<string, string>;
  /** 이 경기 뒤 오늘 남은 경기 수. */
  left: number;
};

export function livePayload(
  season: number,
  state: LiveState,
  snap: LivePayload['snap'],
  filled: LivePayload['filled'],
  lineups: Lineups,
  met: number,
  left: number,
): LivePayload {
  const names: Record<string, string> = {};
  for (const s of [...lineups.home, ...lineups.away])
    if (s.careerId && s.publicName) names[s.careerId] = s.publicName;
  return { v: 1, season, state, snap, filled, met, names, left };
}

const labelOf = (p: LivePayload, lang: Lang) => (ref: PlayerRef) =>
  (ref.careerId ? p.names[ref.careerId] : undefined) ?? anonText(ref.anon, lang);

/** 장면 하나(index는 state.moments의 자리). */
export const liveMomentView = (p: LivePayload, index: number, lang: Lang) =>
  momentView(p.state.moments[index]!, index, true, labelOf(p, lang));

/** 이 장면에서 난 골을 화면 모양으로(내 쪽 = home). */
export const momentGoals = (p: LivePayload, m: StoredMoment, lang: Lang): TeamMatchEvent[] =>
  (m.goals ?? []).map((e) => {
    const label = labelOf(p, lang);
    return {
      minute: e.minute,
      side: e.side,
      scorer: label(e.scorer),
      assist: e.assist ? label(e.assist) : null,
      scorerId: e.side === 'home' ? e.scorer.careerId : null,
      assistId: e.side === 'home' ? (e.assist?.careerId ?? null) : null,
      slot: e.slot,
    };
  });

const viewOf = (m: StoredMoment): StoredMomentView => ({
  minute: m.minute,
  kind: m.kind,
  situation: m.situation,
  actor: m.actor,
  mate: m.mate,
  opp: m.opp,
  choices: m.choices,
  ...(m.picked === undefined ? {} : { picked: m.picked, ok: !!m.ok }),
});

/**
 * 시작 응답: 지금까지 정해진 골(장면을 뺀 일반 골 + 넘쳐서 자동 판정한 장면)만 담은 경기와, 고를 장면. 기록 · 레이팅은 경기 전 값이다.
 */
export function liveStartResponse(
  row: Pick<TeamLiveRow, 'id' | 'createdAt'>,
  p: LivePayload,
  mine: OwnerTeamRow,
  opp: OwnerTeamRow,
  lang: Lang,
): PlayTeamMatchResponse {
  const events = liveEvents(p.state);
  const head = {
    id: row.id,
    homeTeamId: mine.id,
    homeGoals: events.filter((e) => e.side === 'home').length,
    awayGoals: events.filter((e) => e.side === 'away').length,
    createdAt: row.createdAt,
  };
  const match = toMatch(
    head,
    { home: p.snap.home, away: p.snap.away, events: events.map(storedEvent) },
    mine.id,
    new Map(Object.entries(p.names)),
    new Map([
      [mine.id, logoOf(mine)],
      [opp.id, logoOf(opp)],
    ]),
    lang,
  );
  return {
    match,
    record: { w: mine.wins, d: mine.draws, l: mine.losses },
    rating: mine.rating,
    matchesLeft: p.left,
    live: {
      moments: p.state.moments.flatMap((m, i) =>
        m.shown && m.picked === undefined ? [liveMomentView(p, i, lang)] : [],
      ),
      choiceSec: MOMENT_RULES.choiceSec,
    },
  };
}

export type Finalized = {
  response: PlayTeamMatchResponse;
  season: number;
  /** 이번 호출이 마감했으면 true(다른 요청이 먼저 마감했으면 false). */
  fresh: boolean;
  homeTeamId: string;
  awayTeamId: string;
  homeProfileId: string;
  awayProfileId: string | null;
};

/**
 * 남은 장면을 자동 선택으로 판정하고 경기를 남긴다(레이팅 · 전적 · 상대 알림). 이미 마감한 경기면 남긴 응답을 돌려준다.
 * 같은 경기를 두 요청이 함께 마감하면 team_matches 기본 키가 겹쳐 늦은 쪽 batch가 통째로 실패하고, 먼저 마감한 응답을 읽는다.
 */
export async function finalizeLive(
  db: Db,
  row: TeamLiveRow,
  now: string,
  lang: Lang,
): Promise<Finalized | null> {
  const p = JSON.parse(row.stateJson) as LivePayload;
  const ids = {
    season: p.season,
    homeTeamId: row.homeTeamId,
    awayTeamId: row.awayTeamId,
    homeProfileId: row.profileId,
  };
  if (row.doneAt && row.resultJson)
    return {
      response: JSON.parse(row.resultJson) as PlayTeamMatchResponse,
      fresh: false,
      ...ids,
      awayProfileId: null,
    };
  finishMoments(p.state);
  const result = liveResult(p.state);
  const [[home], [away]] = await teamsForLive(db, row.homeTeamId, row.awayTeamId);
  if (!home || !away) return null;
  const score = matchScore(result.homeGoals, result.awayGoals);
  const delta = ratingChange(home.rating, away.rating, score, p.met);
  const detail = {
    home: { ...p.snap.home, ratingChange: delta.home },
    away: { ...p.snap.away, ratingChange: delta.away },
    events: result.events.map(storedEvent),
    moments: p.state.moments.filter((m) => m.shown).map(viewOf),
  };
  const head = {
    id: row.id,
    homeTeamId: home.id,
    homeGoals: result.homeGoals,
    awayGoals: result.awayGoals,
    createdAt: row.createdAt,
  };
  const response: PlayTeamMatchResponse = {
    match: toMatch(
      head,
      detail,
      home.id,
      new Map(Object.entries(p.names)),
      new Map([
        [home.id, logoOf(home)],
        [away.id, logoOf(away)],
      ]),
      lang,
    ),
    record: {
      w: home.wins + (score === 1 ? 1 : 0),
      d: home.draws + (score === 0.5 ? 1 : 0),
      l: home.losses + (score === 0 ? 1 : 0),
    },
    rating: home.rating + delta.home,
    matchesLeft: p.left,
  };
  try {
    await commitNotifiedEvent(
      db,
      [
        ...recordMatchStatements(db, {
          id: row.id,
          profileId: row.profileId,
          home: {
            teamId: home.id,
            filled: p.filled.home,
            ovr: p.snap.home.ovr,
            goals: result.homeGoals,
            rating: delta.home,
          },
          away: {
            teamId: away.id,
            filled: p.filled.away,
            ovr: p.snap.away.ovr,
            goals: result.awayGoals,
            rating: delta.away,
          },
          detail,
          now: row.createdAt,
        }),
        markLiveDone(db, row.id, JSON.stringify(p), JSON.stringify(response), now),
      ],
      matchNotice(row.id, home, away, result.homeGoals, result.awayGoals, now),
    );
  } catch (e) {
    const again = await liveById(db, row.id);
    if (again?.doneAt && again.resultJson)
      return {
        response: JSON.parse(again.resultJson) as PlayTeamMatchResponse,
        fresh: false,
        ...ids,
        awayProfileId: away.profileId,
      };
    throw e;
  }
  return { response, fresh: true, ...ids, awayProfileId: away.profileId };
}

/** 고르지 않고 떠난 장면 경기를 자동 선택으로 마감하고, 하루 지난 마감 줄을 지운다(5분 cron). */
export async function finishStaleLive(db: Db, nowIso: string, limit = 50) {
  const now = Date.parse(nowIso);
  const rows = await staleLive(
    db,
    new Date(now - MOMENT_RULES.staleMin * 60_000).toISOString(),
    limit,
  );
  let done = 0;
  for (const row of rows) {
    const f = await finalizeLive(db, row, nowIso, 'ko');
    if (!f?.fresh) continue;
    done++;
    await refreshBoth(db, f);
  }
  await purgeDoneLive(db, new Date(now - 86_400_000).toISOString());
  return { done, checked: rows.length };
}

/** 마감한 경기의 두 구단주 점수를 다시 센다. */
export function refreshBoth(db: Db, f: Finalized) {
  return Promise.all([
    refreshAfterChange(db, f.homeProfileId, f.season),
    ...(f.awayProfileId ? [refreshAfterChange(db, f.awayProfileId, f.season)] : []),
  ]);
}
