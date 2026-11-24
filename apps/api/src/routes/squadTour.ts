import {
  TourMatchResponseSchema,
  TourOrderBodySchema,
  TourRankingResponseSchema,
  TourStartBodySchema,
  TourStateResponseSchema,
  type TourMatchView,
  type TourStage,
} from '@offside/contracts';
import { kstDay } from '@offside/contracts/kst';
import { teamSeasonAt } from '@offside/contracts/service-seasons';
import {
  TOUR_MAIN_STAGES,
  TOUR_TACTICS,
  tourFee,
  tourMerc,
  tourOpp,
  tourRules,
  tourScore,
  tourStars,
  tourWeekOf,
} from '@offside/contracts/squad-tour';
import type { Context, Hono } from 'hono';
import { newId } from '../db/ids.js';
import { activeBalanceQuery, tourOpenFrom } from '../db/repos/balance.js';
import { listEligibleCareers, toLineupCareer } from '../db/repos/ownerTeams.js';
import {
  finishTourMatch,
  saveTourSegment,
  starsOf,
  startTourMatch,
  tourMatchOf,
  tourMine,
  tourRankOf,
  tourRanking,
  type TourMatchRow,
} from '../db/repos/squadTour.js';
import { edgeCached, purgeEdge } from '../edgeCache.js';
import { EDGE } from '../edgeKeys.js';
import { getDb, getPublicReadDb, type AppEnv } from '../env.js';
import { tourText as en } from '../i18n/en/tour.js';
import { tourText as ja } from '../i18n/ja/tour.js';
import { tourText as ko } from '../i18n/ko/tour.js';
import { tourText as zh } from '../i18n/zh/tour.js';
import { reqLang } from '../lang.js';
import { idempotency } from '../middleware/idempotency.js';
import { requireOwner } from '../middleware/requireOwner.js';
import { requireProfile } from '../middleware/requireProfile.js';
import type { LineupCareer } from '../team/sim.js';
import { tourOpponent, tourOppFormation, tourSlotsError } from '../team/squadTour.js';
import {
  applyTourOrder,
  playTourSegment,
  startTourLive,
  tourLiveChance,
  tourLiveOver,
  tourLiveResult,
  tourOppTactic,
  type TourLive,
} from '../team/squadTourLive.js';
import { conflictError, NO_STORE, notFoundError, nowIso, ok, readBody } from './shared.js';

// T-11-825 원정 투어(주간 스쿼드 챌린지). 매주 모두에게 같은 AI 구단 사다리를 차례로 원정 간다. 로그인 구단주만(순위 · 대전료가
// 붙는다). 밸런스 tourOpen이 0이면 닫혀 있다. 경기는 세 구간으로 나눠 치르고 구간 사이(30분 · 60분)에 전술 · 교체 지시를 받는다.

const RANKING_TTL = 60;
/** 본선을 다 이긴 뒤 미리 보여 주는 무한 원정 경기 수. */
const AHEAD = 1;

/** 경기 줄에 굳혀 둔 값: 작전 경기 상태와 그때 명단에 든 카드. */
type Stored = { live: TourLive; cards: LineupCareer[] };

const TEXT = { ko, en, ja, zh };
const T = (c: Context<AppEnv>) => TEXT[reqLang(c)];
const closed = (c: Context<AppEnv>) => notFoundError(T(c).closed, 'TOUR_CLOSED');

function stageOf(week: string, stage: number, stars: Record<string, number>): TourStage {
  return {
    stage,
    opp: tourOpp(stage),
    formation: tourOppFormation(week, stage),
    tactic: tourOppTactic(week, stage),
    rules: tourRules(week, stage),
    fee: tourFee(stage),
    merc: tourMerc(stage),
    stars: stars[String(stage)] ?? 0,
  };
}

function matchView(
  row: Pick<TourMatchRow, 'id' | 'week' | 'stage' | 'tryNo'>,
  stored: Stored,
  status: TourMatchView['status'],
  result: TourMatchView['result'],
): TourMatchView {
  const s = stored.live;
  const names = new Map(stored.cards.map((c) => [c.id, c.publicName]));
  const label = (ref: { careerId: string | null; anon: string }) =>
    (ref.careerId && names.get(ref.careerId)) || ref.anon;
  const timeout = status === 'live' && !tourLiveOver(s);
  const rules = tourRules(row.week, row.stage);
  const opp = tourOpponent(row.week, row.stage);
  return {
    id: row.id,
    stage: row.stage,
    tryNo: row.tryNo,
    status,
    done: s.done,
    formation: s.formation,
    slotIds: s.slotIds,
    bench: s.bench,
    subsLeft: s.subsLeft,
    tactic: s.tactic,
    stamina: s.stamina.map((x) => Math.round(x)),
    oppTactic: s.oppTactic,
    goalsFor: s.goalsFor,
    goalsAgainst: s.goalsAgainst,
    events: s.events.map((e) => ({
      minute: e.minute,
      side: e.side,
      scorer: label(e.scorer),
      assist: e.assist ? label(e.assist) : null,
      scorerId: e.side === 'away' ? e.scorer.careerId : null,
      assistId: e.side === 'away' ? (e.assist?.careerId ?? null) : null,
      slot: e.slot,
    })),
    chances: timeout
      ? Object.fromEntries(
          TOUR_TACTICS.map((t) => [
            t,
            Math.round(tourLiveChance(s, stored.cards, rules, opp, t) * 1000) / 1000,
          ]),
        )
      : null,
    result,
  };
}

export function registerSquadTourRoutes(app: Hono<AppEnv>): void {
  // 투어 홈: 이번 주 사다리 · 내 진행 · 오늘 남은 도전 · 진행 중인 경기. 투어 화면을 열 때만 부른다.
  app.get('/v1/tour', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const now = nowIso();
    const week = tourWeekOf(now);
    const season = teamSeasonAt(now);
    const [balance] = await activeBalanceQuery(db);
    const open = tourOpenFrom(balance);
    if (!open || season === null)
      return ok(
        c,
        TourStateResponseSchema,
        {
          open: false,
          week,
          season: season ?? 0,
          cleared: 0,
          score: 0,
          rank: null,
          triesLeft: 0,
          stages: [],
          live: null,
        },
        200,
        NO_STORE,
      );
    const mine = await tourMine(db, me.id, week, kstDay(now));
    const rank = await tourRankOf(db, mine.progress);
    const cleared = mine.progress?.cleared ?? 0;
    const stars = starsOf(mine.progress);
    const last = Math.max(TOUR_MAIN_STAGES, cleared + AHEAD);
    return ok(
      c,
      TourStateResponseSchema,
      {
        open: true,
        week,
        season,
        cleared,
        score: mine.progress?.score ?? 0,
        rank,
        triesLeft: mine.triesLeft,
        stages: Array.from({ length: last }, (_, i) => stageOf(week, i + 1, stars)),
        live: mine.live
          ? matchView(mine.live, JSON.parse(mine.live.stateJson) as Stored, 'live', null)
          : null,
      },
      200,
      NO_STORE,
    );
  });

  // 주간 순위(모두에게 같다). 세션 · 프로필을 읽지 않고 엣지에 1분 둔다. 이긴 경기가 마감될 때 지운다.
  app.get('/v1/tour/ranking', async (c) => {
    const now = nowIso();
    const week = tourWeekOf(now);
    const season = teamSeasonAt(now) ?? 0;
    const data = await edgeCached(c, EDGE.tourRanking(week), RANKING_TTL, async () => {
      const rows = await tourRanking(getPublicReadDb(c), week, season);
      return {
        week,
        rows: rows.map((r, i) => ({
          rank: i + 1,
          teamId: r.teamId,
          name: r.name ?? '',
          cleared: r.cleared,
          score: r.score,
          stars: Object.values(starsOf(r)).reduce((a, b) => a + b, 0),
        })),
      };
    });
    return ok(c, TourRankingResponseSchema, data, 200, `public, max-age=${RANKING_TTL}`);
  });

  // 원정 출발: 도전권을 한 번 쓰고 첫 30분을 치른다. 편성(선발 11 + 교체 명단) · 전술을 받는다.
  app.post('/v1/tour/matches', requireProfile, idempotency, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const input = readBody(c, TourStartBodySchema);
    const now = nowIso();
    const season = teamSeasonAt(now);
    const week = tourWeekOf(now);
    const day = kstDay(now);
    const [[balance], players] = await db.batch([
      activeBalanceQuery(db),
      listEligibleCareers(db, me.id, season ?? 0),
    ]);
    if (season === null || !tourOpenFrom(balance)) throw closed(c);
    const mine = await tourMine(db, me.id, week, day);
    if (mine.live) throw conflictError(T(c).live, 'TOUR_LIVE');
    if (mine.triesLeft <= 0) throw conflictError(T(c).noTries, 'TOUR_NO_TRIES');
    if (input.stage !== (mine.progress?.cleared ?? 0) + 1)
      throw conflictError(T(c).stage, 'TOUR_STAGE');
    // 판매에 올린 카드는 뛰지 못한다(경기 도중 팔릴 수 있다).
    const owned = players.filter((p) => !p.listingId).map((p) => toLineupCareer(p));
    const rules = tourRules(week, input.stage);
    const picked = new Set([...input.slotIds.filter((id) => id !== null), ...input.bench]);
    if (picked.size !== input.slotIds.filter((id) => id !== null).length + input.bench.length)
      throw conflictError(T(c).dup, 'TOUR_LINEUP');
    const byId = new Map(owned.map((k) => [k.id, k]));
    if (input.bench.some((id) => !byId.has(id))) throw conflictError(T(c).gone, 'TOUR_LINEUP');
    if (tourSlotsError(input.formation, input.slotIds, owned, rules, season))
      throw conflictError(T(c).rule, 'TOUR_LINEUP');
    const cards = [...picked].map((id) => byId.get(id)!);
    const id = newId('tur');
    const opp = tourOpponent(week, input.stage);
    const live = playTourSegment(
      startTourLive({
        seed: id,
        season,
        formation: input.formation,
        slotIds: input.slotIds,
        bench: input.bench,
        tactic: input.tactic,
        merc: tourMerc(input.stage),
        oppTactic: tourOppTactic(week, input.stage),
      }),
      cards,
      rules,
      opp,
    );
    const stored: Stored = { live, cards };
    const started = await startTourMatch(db, {
      id,
      profileId: me.id,
      week,
      day,
      stage: input.stage,
      done: live.done,
      stateJson: JSON.stringify(stored),
      now,
    });
    if (!started) throw conflictError(T(c).noTries, 'TOUR_NO_TRIES');
    return ok(
      c,
      TourMatchResponseSchema,
      {
        match: matchView(
          { id, week, stage: input.stage, tryNo: started.tryNo },
          stored,
          'live',
          null,
        ),
        triesLeft: mine.triesLeft - 1,
        balance: null,
      },
      200,
      NO_STORE,
    );
  });

  // 작전 타임 지시(전술 · 교체)를 받고 다음 30분을 치른다. 마지막 구간이 끝나면 경기를 마감한다(이기면 진행 · 대전료).
  app.post('/v1/tour/matches/:id/orders', requireProfile, idempotency, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const input = readBody(c, TourOrderBodySchema);
    const now = nowIso();
    const [row] = await tourMatchOf(db, me.id, c.req.param('id'));
    if (!row) throw notFoundError(T(c).notFound, 'TOUR_MATCH_NOT_FOUND');
    const stored = JSON.parse(row.stateJson) as Stored;
    const left = async () => (await tourMine(db, me.id, tourWeekOf(now), kstDay(now))).triesLeft;
    const current = async (r: TourMatchRow) =>
      ok(
        c,
        TourMatchResponseSchema,
        {
          match: matchView(
            r,
            JSON.parse(r.stateJson) as Stored,
            r.status as TourMatchView['status'],
            null,
          ),
          triesLeft: await left(),
          balance: null,
        },
        200,
        NO_STORE,
      );
    // 이미 지난 작전 타임의 지시(다시 보낸 요청)는 버리고 지금 상태를 돌려준다.
    if (row.status !== 'live' || row.done !== input.done) return current(row);
    const rules = tourRules(row.week, row.stage);
    const opp = tourOpponent(row.week, row.stage);
    const ordered = applyTourOrder(
      stored.live,
      { ...(input.tactic ? { tactic: input.tactic } : {}), subs: input.subs ?? [] },
      stored.cards,
      rules,
    );
    if (typeof ordered === 'string')
      throw conflictError(ordered === 'rule' ? T(c).subRule : T(c).order, 'TOUR_ORDER');
    const live = playTourSegment(ordered, stored.cards, rules, opp);
    const next: Stored = { live, cards: stored.cards };
    const stateJson = JSON.stringify(next);
    if (!tourLiveOver(live)) {
      const saved = await saveTourSegment(db, {
        id: row.id,
        from: row.done,
        done: live.done,
        stateJson,
      });
      if (!saved) {
        const [again] = await tourMatchOf(db, me.id, row.id);
        return current(again ?? row);
      }
      return ok(
        c,
        TourMatchResponseSchema,
        { match: matchView(row, next, 'live', null), triesLeft: await left(), balance: null },
        200,
        NO_STORE,
      );
    }
    const res = tourLiveResult(live, stored.cards, rules, opp);
    const diff = res.pens ? 0 : live.goalsFor - live.goalsAgainst;
    const score = res.win ? tourScore(row.stage, diff, row.tryNo) : 0;
    const stars = tourStars(res.win, row.tryNo, diff);
    const done = await finishTourMatch(db, {
      id: row.id,
      profileId: me.id,
      week: row.week,
      stage: row.stage,
      from: row.done,
      done: live.done,
      stateJson,
      win: res.win,
      score,
      stars,
      fee: tourFee(row.stage),
      now,
    });
    if (!done) {
      const [again] = await tourMatchOf(db, me.id, row.id);
      return current(again ?? row);
    }
    if (res.win) purgeEdge(c, [EDGE.tourRanking(row.week)]);
    return ok(
      c,
      TourMatchResponseSchema,
      {
        match: matchView(row, next, res.win ? 'won' : 'lost', {
          pens: res.pens,
          stars,
          score,
          fee: done.fee,
        }),
        triesLeft: await left(),
        balance: done.balance,
      },
      200,
      NO_STORE,
    );
  });
}
