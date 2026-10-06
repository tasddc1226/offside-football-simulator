// T-11-128 구단주 티어 표시 — 구단주 랭킹과 같은 업적 등급(루키 ~ 레전드)을 지난 시즌 마감 업적 점수로 정한다
// (contracts owner-tier.ts). 그림은 랭킹과 같은 등급 엠블럼(gradeEmblem.ts).
import type { OwnerTierTag, SeasonRecap, SeasonRecapResponse } from '@offside/contracts';
import { ACH_GRADES } from '@offside/contracts/owner-team';
import { ownerTierOf, type OwnerTier } from '@offside/contracts/owner-tier';
import { seasonRecapText as L } from './i18n/ko/seasonRecap.js';
import { teamSeasonLabel } from './seasonName.js';
import { achGradeName } from './teamOwner.js';
import { num } from './teamText.js';

export type { OwnerTier } from '@offside/contracts/owner-tier';
export type { OwnerTierTag } from '@offside/contracts';

/** 등급 이름(지금 언어). */
export const tierName = (tier: OwnerTier): string =>
  achGradeName(ACH_GRADES.find((g) => g.id === tier) ?? ACH_GRADES[0]);

/** '프리시즌 골드' — 프로필 · 툴팁. */
export const tierTitle = (t: { tier: OwnerTier; season: number }): string =>
  L.tierTitle({ season: teamSeasonLabel(t.season), tier: tierName(t.tier) });

/** 결산의 티어(서버 ownerTiersOf와 같은 값 — 마감 업적 점수의 등급). */
export const recapTier = (r: SeasonRecap): OwnerTier => ownerTierOf(r.achievements?.score);

/** 티어를 정한 까닭 한 줄 — '업적 점수 1,240점으로 마감'. */
export const tierReason = (r: SeasonRecap): string =>
  L.tierWhy({ score: num(r.achievements?.score ?? 0) });

/** 구단주 프로필 지난 시즌 등급 — 결산이 나온 구단주만(그 시즌 기록이 없거나 굳히는 중이면 없다). */
export const profileTier = (res: SeasonRecapResponse): OwnerTierTag | null =>
  res.status === 'ready' && res.recap ? { tier: recapTier(res.recap), season: res.season } : null;
