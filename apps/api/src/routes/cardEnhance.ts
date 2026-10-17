import {
  CareerIdParamSchema,
  EnhanceBodySchema,
  EnhanceResponseSchema,
  EnhanceStateResponseSchema,
} from '@offside/contracts';
import {
  ENHANCE_MAX,
  enhanceCost,
  enhanceOutcome,
  enhanceRate,
} from '@offside/contracts/card-enhance';
import { teamSeasonAt } from '@offside/contracts/service-seasons';
import type { Hono } from 'hono';
import { attemptEnhance, enhanceRules, enhanceSnapshot } from '../db/repos/cardEnhance.js';
import { newId } from '../db/ids.js';
import { parseWithAppError } from '../errors.js';
import { getDb, type AppEnv } from '../env.js';
import { idempotency } from '../middleware/idempotency.js';
import { requireProfile } from '../middleware/requireProfile.js';
import { checkCupEnhance } from './cup.js';
import { kstTodayStart, requireOwner } from './ownerTeam.js';
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

// T-11-373 카드 강화(docs/tracking/card-enhance-plan.md). 구단 자금만 받고, 판정은 여기서만 한다(crypto 난수). 화면은 강화 창을 열 때
// 상태를 한 번 읽고, 시도마다 본 단계 · 비용을 보내 어긋나면 409를 받는다. 재시도는 멱등 키로 한 번만 판정 · 차감한다.

const stale = () => conflictError('강화 상태가 바뀌었어요. 다시 확인해 주세요.', 'ENHANCE_STALE');

/** [0, 1) 난수(32비트). */
const roll = () => crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32;

export function registerCardEnhanceRoutes(app: Hono<AppEnv>): void {
  // 강화 창을 열 때만 부른다(오늘 쓴 횟수 · 잔액 · 운영 수치).
  app.get('/v1/cards/enhance', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const [snap, rules] = await Promise.all([
      enhanceSnapshot(db, me.id, kstTodayStart(nowIso())),
      enhanceRules(db),
    ]);
    return ok(
      c,
      EnhanceStateResponseSchema,
      { rules, used: snap.used, balance: snap.balance },
      200,
      NO_STORE,
    );
  });

  app.post('/v1/cards/:careerId/enhance', requireProfile, idempotency, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const careerId = parseWithAppError(CareerIdParamSchema, c.req.param('careerId'));
    const input = readBody(c, EnhanceBodySchema);
    const now = nowIso();
    const since = kstTodayStart(now);
    const [snap, rules] = await Promise.all([
      enhanceSnapshot(db, me.id, since, careerId),
      enhanceRules(db),
    ]);
    const card = snap.card;
    if (!card || card.ownerId !== me.id)
      throw notFoundError('내 선수 카드를 찾을 수 없어요.', 'CARD_NOT_FOUND');
    if (card.manager) throw conflictError('감독 카드는 강화할 수 없어요.', 'CARD_MANAGER');
    if (card.cardValue === null)
      throw conflictError('기준가가 없는 옛 기록은 강화할 수 없어요.', 'CARD_NOT_TRADABLE');
    if (card.listed) throw conflictError('판매 등록 중인 선수는 강화할 수 없어요.', 'CARD_LISTED');
    if (card.enhance >= ENHANCE_MAX) throw conflictError('이미 가장 높은 단계예요.', 'ENHANCE_MAX');
    if (rules.dailyCap === 0)
      throw conflictError('지금은 카드 강화를 쉬고 있어요.', 'ENHANCE_CLOSED');
    if (snap.used >= rules.dailyCap)
      throw conflictError(`오늘은 ${rules.dailyCap}번까지 카드를 강화할 수 있어요.`, 'DAILY_LIMIT');
    const cost = enhanceCost(card.enhance, rules)!;
    if (input.level !== card.enhance || input.cost !== cost) throw stale();
    // 잔액 행이 없거나 모자라면 batch 전에 막는다(행이 없으면 출금 UPDATE가 0행으로 지나가 공짜가 된다).
    if (snap.balance < cost) throw fundsShort();
    const season = teamSeasonAt(now);
    if (season !== null) await checkCupEnhance(db, me.id, season, careerId, now);

    const r = roll();
    const rate = enhanceRate(card.enhance, card.fails, rules);
    const out = enhanceOutcome(card.enhance, card.fails, r, rules);
    let res: Awaited<ReturnType<typeof attemptEnhance>>;
    try {
      res = await attemptEnhance(db, {
        id: newId('enh'),
        profileId: me.id,
        careerId,
        from: card.enhance,
        fails: card.fails,
        to: out.to,
        nextFails: out.fails,
        success: out.success,
        rateBp: Math.round(rate * 10_000),
        roll: Math.floor(r * 1_000_000),
        cost,
        used: snap.used,
        since,
        now,
      });
    } catch (e) {
      // 같은 구단주가 동시에 영입 · 구매를 해 잔액이 모자라게 되면 CHECK 위반으로 batch 전체가 되돌아간다.
      if (isFundsCheck(e)) throw fundsShort();
      throw e;
    }
    // 같은 순간 다른 기기에서 같은 카드를 강화했거나 판매 등록했다.
    if (!res.won) throw stale();
    return ok(
      c,
      EnhanceResponseSchema,
      {
        success: out.success,
        from: card.enhance,
        to: out.to,
        fails: out.fails,
        cost,
        balance: res.balance,
        used: snap.used + 1,
      },
      200,
      NO_STORE,
    );
  });
}
