import {
  CareerIdParamSchema,
  EnhanceBodySchema,
  EnhanceResponseSchema,
  EnhanceStateResponseSchema,
  IDEMPOTENCY_KEY_HEADER,
} from '@offside/contracts';
import {
  ENHANCE_MAX,
  enhanceCost,
  enhanceDownBp,
  enhanceOutcome,
  enhanceRateBp,
  enhanceTierRules,
  type EnhanceCardState,
} from '@offside/contracts/card-enhance';
import { type FormationId } from '@offside/contracts/owner-team';
import { teamSeasonAt } from '@offside/contracts/service-seasons';
import type { Context, Hono } from 'hono';
import {
  attemptEnhance,
  enhanceByRequestKey,
  enhanceRules,
  enhanceSnapshot,
  type EnhanceCardRow,
  type EnhanceTeamChange,
} from '../db/repos/cardEnhance.js';
import { enhanceTitlesAfter } from '../db/repos/ownerTitles.js';
import {
  careersByIds,
  cupPresetOf,
  eligibleMap,
  layoutOf,
  myTeamIn,
  presetsOf,
  slotIdsOf,
  type OwnerTeamRow,
} from '../db/repos/ownerTeams.js';
import { purgeEdge } from '../edgeCache.js';
import { STALE } from '../edgeKeys.js';
import { buildLineup, lineupOvr } from '../team/sim.js';
import type { Db } from '../db/client.js';
import { newId } from '../db/ids.js';
import { AppError, parseWithAppError } from '../errors.js';
import { getDb, type AppEnv } from '../env.js';
import { requireOwner } from '../middleware/requireOwner.js';
import { requireProfile } from '../middleware/requireProfile.js';
import { checkCupEnhance } from './cup.js';
import {
  conflictError,
  fundsShort,
  isFundsCheck,
  NO_STORE,
  notFoundError,
  nowIso,
  ok,
  readBody,
} from './shared.js';

// T-11-373 카드 강화(docs/tracking/card-enhance-plan.md). 구단 자금을 쓰고, 판정은 여기서만 한다(crypto
// 난수). 화면은 강화 창을 열 때 그 카드 상태를 한 번 읽고, 시도마다 본 단계 · 실패 수 · 비용 · 성공 · 실패 확률을 보내 어긋나면 409를
// 받는다. 재시도는 같은 Idempotency-Key로 보내면 판정 · 차감과 같은 batch에 남은 기록으로 한 번만 처리한다.

const stale = () => conflictError('강화 상태가 바뀌었어요. 다시 확인해 주세요.', 'ENHANCE_STALE');

const REQUEST_KEY = /^[A-Za-z0-9_-]{8,128}$/;

/** [0, 10000) 정수 난수(만분율 판정). */
const roll = () => crypto.getRandomValues(new Uint32Array(1))[0]! % 10_000;

const stateOf = (card: EnhanceCardRow): EnhanceCardState => ({
  level: card.level,
  fails: card.fails,
  tier: card.tier,
});

function requestKeyOf(c: Context<AppEnv>): string {
  const key = c.req.header(IDEMPOTENCY_KEY_HEADER);
  if (!key || !REQUEST_KEY.test(key))
    throw new AppError({
      code: 'VALIDATION_FAILED',
      message: '요청 식별 정보가 없어요. 다시 시도해 주세요.',
      details: { reason: 'IDEMPOTENCY_KEY_REQUIRED' },
    });
  return key;
}

/** 이 카드가 든 이번 시즌 편성(팀 선발 · 컵 명단). 어디에도 없으면 null이라 카드 · 밸런스를 읽지 않는다(시도당 쿼리 최소화). */
async function lineupsWith(db: Db, careerId: string, team: OwnerTeamRow | undefined) {
  if (!team) return null;
  const slots = slotIdsOf(team);
  const cup = cupPresetOf(team);
  const inTeam = slots.includes(careerId);
  const inCup = !!cup?.slots.includes(careerId);
  if (!inTeam && !inCup) return null;
  const ids = [...slots, ...(cup?.slots ?? [])].filter((x): x is string => !!x);
  return { team, slots, cup, inTeam, inCup, rows: await careersByIds(db, [...new Set(ids)]) };
}
type EnhanceLineups = NonNullable<Awaited<ReturnType<typeof lineupsWith>>>;

/** 이 카드가 level 단계라면 그 시즌 편성에 넣을 수 있는 카드들. */
const eligibleAt = (
  l: EnhanceLineups,
  profileId: string,
  careerId: string,
  season: number,
  level: number,
) =>
  eligibleMap(
    l.rows.map((r) => (r.id === careerId ? { ...r, enhance: level } : r)),
    profileId,
    season,
    true,
  );

/**
 * 단계가 바뀐 뒤의 팀 OVR · 컵 명단 OVR. 저장된 값이 곧 랭킹 · 매칭 · 컵 구간의 기준이므로, 강화 batch에서 함께 고친다.
 * 편성을 저장할 때와 같은 계산이다.
 */
function teamOvrAfter(
  l: EnhanceLineups,
  profileId: string,
  careerId: string,
  season: number,
  level: number,
): EnhanceTeamChange {
  const eligible = eligibleAt(l, profileId, careerId, season, level);
  const { team, cup } = l;
  const cupOvr =
    l.inCup && cup
      ? lineupOvr(buildLineup(cup.formation, cup.slots, eligible, cup.layout))
      : team.cupOvr;
  return {
    id: team.id,
    slotsJson: team.slotsJson,
    presetsJsonBefore: team.presetsJson,
    ovr: l.inTeam
      ? lineupOvr(buildLineup(team.formation as FormationId, l.slots, eligible, layoutOf(team)))
      : team.ovr,
    cupOvr,
    presetsJson:
      l.inCup && cup
        ? JSON.stringify(presetsOf(team).map((p) => (p.cup ? { ...p, ovr: cupOvr ?? 0 } : p)))
        : team.presetsJson,
  };
}

export function registerCardEnhanceRoutes(app: Hono<AppEnv>): void {
  // 강화 창을 열 때만 부른다(그 카드 상태 · 잔액 · 운영 수치).
  app.get('/v1/cards/:careerId/enhance', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const careerId = parseWithAppError(CareerIdParamSchema, c.req.param('careerId'));
    const [snap, rules] = await Promise.all([
      enhanceSnapshot(db, me.id, careerId),
      enhanceRules(db),
    ]);
    if (!snap.card || snap.card.ownerId !== me.id)
      throw notFoundError('내 선수 카드를 찾을 수 없어요.', 'CARD_NOT_FOUND');
    return ok(
      c,
      EnhanceStateResponseSchema,
      { rules, card: stateOf(snap.card), balance: snap.balance },
      200,
      NO_STORE,
    );
  });

  app.post('/v1/cards/:careerId/enhance', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const careerId = parseWithAppError(CareerIdParamSchema, c.req.param('careerId'));
    const requestKey = requestKeyOf(c);
    const input = readBody(c, EnhanceBodySchema);
    const now = nowIso();
    const [snap, rules, done] = await Promise.all([
      enhanceSnapshot(db, me.id, careerId),
      enhanceRules(db),
      enhanceByRequestKey(db, me.id, requestKey),
    ]);
    const card = snap.card;
    if (!card || card.ownerId !== me.id)
      throw notFoundError('내 선수 카드를 찾을 수 없어요.', 'CARD_NOT_FOUND');
    // 같은 시도를 다시 보냈다(응답을 받지 못한 재시도) — 이미 끝난 결과를 그대로 돌려준다.
    if (done) {
      if (done.careerId !== careerId) throw stale();
      return ok(
        c,
        EnhanceResponseSchema,
        {
          success: !!done.success,
          from: done.from,
          to: done.to,
          cost: done.cost,
          balance: snap.balance,
          card: stateOf(card),
        },
        200,
        NO_STORE,
      );
    }
    if (card.manager) throw conflictError('감독 카드는 강화할 수 없어요.', 'CARD_MANAGER');
    if (card.cardValue === null)
      throw conflictError('기준가가 없는 옛 기록은 강화할 수 없어요.', 'CARD_NOT_TRADABLE');
    if (card.listed) throw conflictError('판매 등록 중인 선수는 강화할 수 없어요.', 'CARD_LISTED');
    if (card.level >= ENHANCE_MAX) throw conflictError('이미 가장 높은 단계예요.', 'ENHANCE_MAX');
    if (!rules.open) throw conflictError('지금은 카드 강화를 쉬고 있어요.', 'ENHANCE_CLOSED');
    const cost = enhanceCost(card.level, rules)!;
    // 비용은 구간과 상관없고, 확률만 카드 구간(최고 OVR)의 배율을 받는다.
    const odds = enhanceTierRules(rules, card.tier);
    const rateBp = enhanceRateBp(card.level, odds);
    const downBp = enhanceDownBp(card.level, odds);
    // 화면이 본 값(단계 · 실패 수 · 비용 · 성공 · 실패 확률)이 지금과 다르면 판정하지 않는다.
    if (
      input.level !== card.level ||
      input.fails !== card.fails ||
      input.cost !== cost ||
      input.rateBp !== rateBp ||
      input.downBp !== downBp
    )
      throw stale();
    // 잔액 행이 없거나 모자라면 batch 전에 막는다(batch도 잔액을 다시 본다).
    if (snap.balance < cost) throw fundsShort();
    // 팀 행은 한 번만 읽어 컵 · 리그 잠금 · OVR 계산에 함께 쓴다.
    const season = teamSeasonAt(now);
    const [team] = season === null ? [] : await myTeamIn(db, me.id, season);
    await checkCupEnhance(db, me.id, careerId, season, now, team);
    const lineups = season === null ? null : await lineupsWith(db, careerId, team);

    const r = roll();
    const out = enhanceOutcome(card.level, card.fails, r, odds);
    const teamChange =
      lineups && season !== null && out.to !== card.level
        ? teamOvrAfter(lineups, me.id, careerId, season, out.to)
        : undefined;
    let res: Awaited<ReturnType<typeof attemptEnhance>>;
    try {
      res = await attemptEnhance(db, {
        id: newId('enh'),
        profileId: me.id,
        careerId,
        requestKey,
        from: card.level,
        fails: card.fails,
        to: out.to,
        nextFails: out.fails,
        success: out.success,
        rateBp,
        downBp,
        roll: r,
        cost,
        now,
        ...(teamChange ? { team: teamChange } : {}),
      });
    } catch (e) {
      // 같은 구단주가 동시에 영입 · 구매를 해 잔액이 모자라게 되면 CHECK 위반으로 batch 전체가 되돌아간다.
      if (isFundsCheck(e)) throw fundsShort();
      throw e;
    }
    if (!res.won) {
      // 같은 키의 요청이 동시에 먼저 끝났으면 그 결과를, 아니면(다른 기기에서 강화 · 판매 등록 · 자금 사용) 다시 확인을 돌려준다.
      const raced = await enhanceByRequestKey(db, me.id, requestKey);
      if (!raced || raced.careerId !== careerId) throw stale();
      const after = await enhanceSnapshot(db, me.id, careerId);
      return ok(
        c,
        EnhanceResponseSchema,
        {
          success: !!raced.success,
          from: raced.from,
          to: raced.to,
          cost: raced.cost,
          balance: after.balance,
          card: after.card ? stateOf(after.card) : stateOf(card),
        },
        200,
        NO_STORE,
      );
    }
    // 팀 OVR이 바뀌었으면 팀 저장과 같은 공개 목록 캐시를 지운다.
    if (teamChange && season !== null) purgeEdge(c, STALE.teamSaved(season));
    const titles = await enhanceTitlesAfter(db, me.id, now);
    return ok(
      c,
      EnhanceResponseSchema,
      {
        success: out.success,
        from: card.level,
        to: out.to,
        cost,
        balance: res.balance,
        card: { level: out.to, fails: out.fails, tier: card.tier },
        ...(titles.length ? { titles } : {}),
      },
      200,
      NO_STORE,
    );
  });
}
