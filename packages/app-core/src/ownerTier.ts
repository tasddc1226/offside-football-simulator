// T-11-128 구단주 티어(시즌 휘장) 표시 — 이름 · 정한 까닭. 티어는 지난 시즌 결산 순위로 정한다(contracts owner-tier.ts).
// 모양 · 색은 tierCrest.ts.
import type { SeasonRecap } from '@offside/contracts';
import { ownerTierOf, type OwnerTier, type TierInput } from '@offside/contracts/owner-tier';
import { seasonRecapText as L } from './i18n/ko/seasonRecap.js';
import { teamSeasonLabel } from './seasonName.js';
import { num } from './teamText.js';

export type { OwnerTier } from '@offside/contracts/owner-tier';
export type { OwnerTierTag } from '@offside/contracts';

export const tierName = (tier: OwnerTier): string =>
  ({
    iron: L.tierIron,
    bronze: L.tierBronze,
    silver: L.tierSilver,
    gold: L.tierGold,
    platinum: L.tierPlatinum,
    emerald: L.tierEmerald,
    diamond: L.tierDiamond,
    master: L.tierMaster,
    grandmaster: L.tierGrandmaster,
    challenger: L.tierChallenger,
  })[tier];

/** '프리시즌 다이아몬드' — 프로필 · 툴팁. */
export const tierTitle = (t: { tier: OwnerTier; season: number }): string =>
  L.tierTitle({ season: teamSeasonLabel(t.season), tier: tierName(t.tier) });

type RankRow = { what: string; rank: number | null; ranked: number };
const rankRows = (r: SeasonRecap): RankRow[] => [
  {
    what: L.honorAchievements,
    rank: r.achievements?.rank ?? null,
    ranked: r.achievements?.ranked ?? 0,
  },
  { what: L.honorTeam, rank: r.team?.rank ?? null, ranked: r.team?.ranked ?? 0 },
  { what: L.honorHof, rank: r.hofRank, ranked: r.hofRanked },
];

/** 결산 값으로 티어를 정할 입력(서버 ownerTiersOf와 같은 값). */
export const tierInputOf = (r: SeasonRecap): TierInput => ({
  ranks: rankRows(r),
  retired: r.retired,
  legacy: r.retiredNumbers + r.wallOfHonor + r.firsts,
});

export const recapTier = (r: SeasonRecap): OwnerTier => ownerTierOf(tierInputOf(r));

/** 티어를 정한 까닭 한 줄 — 가장 좋은 순위(비율이 가장 작은 것), 없으면 기록 · 은퇴 선수. */
export function tierReason(r: SeasonRecap): string {
  const best = rankRows(r)
    .filter((x): x is RankRow & { rank: number } => x.rank !== null && x.ranked > 0)
    .sort((a, b) => a.rank - b.rank || a.rank / a.ranked - b.rank / b.ranked)[0];
  if (best) return L.tierWhy({ what: best.what, rank: num(best.rank), total: num(best.ranked) });
  if (r.retiredNumbers + r.wallOfHonor + r.firsts > 0) return L.tierWhyLegacy;
  return r.retired > 0 ? L.tierWhyRetired({ n: r.retired }) : L.tierWhyNone;
}
