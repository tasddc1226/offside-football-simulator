import {
  ExchangeClaimBodySchema,
  ExchangeClaimResponseSchema,
  ExchangeMeResponseSchema,
  resolveBalance,
} from '@offside/contracts';
import {
  exchangeById,
  exchangeReward,
  exchangeMet,
  exchangesAt,
} from '@offside/contracts/card-exchange-rules';
import { teamSeasonAt } from '@offside/contracts/service-seasons';
import type { Hono } from 'hono';
import { newId } from '../db/ids.js';
import { getActiveBalance } from '../db/repos/balance.js';
import {
  claimExchange,
  exchangeCardsOf,
  isClaimCardsCheck,
  myClaimCounts,
} from '../db/repos/cardExchanges.js';
import { refreshOwnerTitles } from '../db/repos/ownerTitles.js';
import { myTeamIn, slotIdsOf } from '../db/repos/ownerTeams.js';
import { getDb, type AppEnv } from '../env.js';
import { idempotency } from '../middleware/idempotency.js';
import { requireProfile } from '../middleware/requireProfile.js';
import { requireOwner } from './ownerTeam.js';
import { conflictError, NO_STORE, notFoundError, nowIso, ok, readBody } from './shared.js';

// T-11-374 카드 바치기 과제. 오늘의 과제 목록은 코드 묶음이라 화면이 직접 그리고, 서버는 내 낸 횟수와 내기만 다룬다.
// 구글 연결 구단주만(requireOwner) — 카드가 서버에 있는 사람만 낼 수 있다. 직접 키워 은퇴시킨 선수만 받고,
// 보상은 오늘 과제를 모두 냈을 때 한 번 준다. 수량은 운영 도구 밸런스 설정(카드 과제 묶음)의 활성 버전을 요청 때 읽는다.

const rewardNow = async (db: Parameters<typeof getActiveBalance>[0]) =>
  exchangeReward(resolveBalance((await getActiveBalance(db))?.values));

export function registerCardExchangeRoutes(app: Hono<AppEnv>): void {
  // 오늘 과제마다 내가 낸 횟수. 카드 과제 화면을 열 때만(웹 메모 1분).
  app.get('/v1/exchanges/me', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const ids = exchangesAt(nowIso()).map((d) => d.id);
    const [claims, reward] = await Promise.all([myClaimCounts(db, me.id, ids), rewardNow(db)]);
    return ok(c, ExchangeMeResponseSchema, { claims, reward }, 200, NO_STORE);
  });

  // 과제에 카드 내기. 카드는 사라진다(주인만 비운다). 오늘 마지막 과제면 보상 아이템을 받는다. 되돌릴 수 없다.
  app.post('/v1/exchanges/:id/claim', requireProfile, idempotency, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const input = readBody(c, ExchangeClaimBodySchema);
    const now = nowIso();
    const season = teamSeasonAt(now);
    const def = exchangeById(now, c.req.param('id'));
    if (!def) throw notFoundError('지금 열린 카드 과제가 아니에요.', 'EXCHANGE_CLOSED');
    const careerIds = [...new Set(input.careerIds)];
    const [cards, [team], reward] = await Promise.all([
      exchangeCardsOf(db, me.id, careerIds),
      season === null ? Promise.resolve([]) : myTeamIn(db, me.id, season),
      rewardNow(db),
    ]);
    if (cards.length !== careerIds.length)
      throw conflictError(
        '낼 수 없는 선수가 섞여 있어요. 목록을 새로 받아 주세요.',
        'EXCHANGE_CARDS_GONE',
      );
    if (cards.some((k) => !k.raised))
      throw conflictError('직접 키워 은퇴시킨 선수만 낼 수 있어요.', 'EXCHANGE_NOT_RAISED');
    // 컵 명단도 지금 시즌 선발 안에 있다 — 선발 선수는 방출처럼 팀에서 뺀 뒤 낸다.
    const lineup = new Set(team ? slotIdsOf(team) : []);
    if (careerIds.some((id) => lineup.has(id)))
      throw conflictError('선발에 든 선수는 팀에서 뺀 뒤 낼 수 있어요.', 'IN_LINEUP');
    if (!exchangeMet(def.rule, cards))
      throw conflictError('과제 조건에 맞지 않는 선수가 있어요.', 'EXCHANGE_UNMET');
    let res: Awaited<ReturnType<typeof claimExchange>>;
    try {
      res = await claimExchange(db, {
        id: newId('xch'),
        profileId: me.id,
        def,
        dayIds: exchangesAt(now).map((d) => d.id),
        reward,
        careerIds,
        now,
      });
    } catch (e) {
      // 그 사이 카드가 잠기거나 판매에 오르거나 감독이 됐다 — batch 전체가 되돌아간다.
      if (isClaimCardsCheck(e))
        throw conflictError(
          '낼 수 없는 선수가 섞여 있어요. 목록을 새로 받아 주세요.',
          'EXCHANGE_CARDS_GONE',
        );
      throw e;
    }
    if (!res.claimed) throw conflictError('이 과제는 오늘 이미 냈어요.', 'EXCHANGE_LIMIT');
    const titles = res.completed ? await refreshOwnerTitles(db, me.id, now) : [];
    return ok(
      c,
      ExchangeClaimResponseSchema,
      {
        claimed: careerIds.length,
        done: res.done,
        rewards: res.completed ? reward : [],
        titles,
      },
      200,
      NO_STORE,
    );
  });
}
