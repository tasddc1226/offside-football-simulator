// T-11-487 시즌 1 기록 보상(홈 선물 칸, 시즌 2 동안 한 번). 시즌 결산(seasonClose)의 명예의 전당 기준과 같은 선수만,
// 같은 마감 시각까지 은퇴한 기록으로 센다 — 마감 뒤엔 바뀌지 않아 언제 물어도 같다. 결산이 끝나기 전에 물어도 되게
// owner_season_records 대신 careers를 바로 센다. 로그인 확인은 라우트(requireOwner)가 한다.
import { CARD_ICON_SCORE, CARD_LEGEND_SCORE } from '@offside/contracts/card-tier';
import { HOF_MIN_RETIRE_AGE } from '@offside/contracts/hof-rules';
import {
  RECORD_HOF_TIERS,
  RECORD_SEASON_GIFT,
  seasonRecordRewardOf,
  type SeasonRecordFacts,
} from '@offside/contracts/owner-team';
import { teamSeasonAt, teamSeasonEndsAt } from '@offside/contracts/service-seasons';
import type { Db } from '../db/client.js';

/** 보상이 있는 가장 낮은 순위 — 이 아래는 순위를 끝까지 세지 않는다. */
const LAST_RANK = RECORD_HOF_TIERS[RECORD_HOF_TIERS.length - 1]!.maxRank;

/** 그 시즌 명예의 전당 선수(seasonClose hofCareers와 같은 기준, careers 별칭 c). 인덱스를 타게 시즌은 그대로 비교한다. */
const HOF = `c.status = 'retired' AND c.hidden = 0 AND c.service_season = ? AND c.legend_score IS NOT NULL
  AND c.retire_age >= ${HOF_MIN_RETIRE_AGE} AND c.retired_at <= ?`;

/** 구단주의 시즌 기록. 명예의 전당 선수가 없으면 null. */
export async function seasonRecordFactsOf(
  db: Db,
  profileId: string,
  season: number,
  cutoff: string,
): Promise<SeasonRecordFacts | null> {
  const d1 = db.$client;
  const [agg, best] = await d1.batch<Record<string, number | string | null>>([
    d1
      .prepare(
        `SELECT count(*) AS n, coalesce(sum(c.legend_score >= ${CARD_ICON_SCORE}), 0) AS icons,
                coalesce(sum(c.legend_score >= ${CARD_LEGEND_SCORE}), 0) AS legends,
                coalesce(sum(c.ballon > 0), 0) AS ballons
           FROM careers c WHERE c.profile_id = ? AND ${HOF}`,
      )
      .bind(profileId, season, cutoff),
    d1
      .prepare(
        `SELECT c.legend_score AS s, c.retired_at AS r, c.id AS id FROM careers c
          WHERE c.profile_id = ? AND ${HOF} ORDER BY c.legend_score DESC, c.retired_at, c.id LIMIT 1`,
      )
      .bind(profileId, season, cutoff),
  ]);
  const a = agg?.results[0];
  const b = best?.results[0];
  if (!a || !b || !Number(a.n)) return null;
  // 순위 = 앞선 선수 수 + 1(명예의 전당 · 결산과 같은 순서: 점수 높은 순 → 먼저 은퇴 → id). 보상 밖이면 세다 멈춘다.
  const ahead = await d1
    .prepare(
      `SELECT count(*) AS n FROM (SELECT 1 FROM careers c WHERE ${HOF}
          AND (c.legend_score > ?3 OR (c.legend_score = ?3 AND (c.retired_at < ?4 OR (c.retired_at = ?4 AND c.id < ?5))))
          LIMIT ${LAST_RANK})`,
    )
    .bind(season, cutoff, b.s, b.r, b.id)
    .first<{ n: number }>();
  const n = Number(ahead?.n ?? LAST_RANK);
  return {
    hofRank: n < LAST_RANK ? n + 1 : null,
    icons: Number(a.icons),
    legends: Number(a.legends),
    ballonPlayers: Number(a.ballons),
  };
}

/** 지금 받을 수 있는 시즌 기록 보상. 열린 시즌이 아니거나 받았거나 받을 게 없으면 null. */
export async function seasonRecordGiftOf(db: Db, profileId: string, now: string) {
  const g = RECORD_SEASON_GIFT;
  if (teamSeasonAt(now) !== g.openSeason) return null;
  const cutoff = teamSeasonEndsAt(g.season);
  if (!cutoff) return null;
  const claimed = await db.$client
    .prepare(`SELECT 1 AS x FROM gift_claims WHERE profile_id = ? AND gift_id = ?`)
    .bind(profileId, g.id)
    .first();
  if (claimed) return null;
  const facts = await seasonRecordFactsOf(db, profileId, g.season, cutoff);
  if (!facts) return null;
  const { parts, total } = seasonRecordRewardOf(facts);
  return total.reroll + total.scout + total.boost > 0 ? { facts, parts, total } : null;
}
