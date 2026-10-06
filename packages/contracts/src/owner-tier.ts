// T-11-128 구단주 티어(지난 시즌) — 구단주 랭킹과 같은 업적 등급(ACH_GRADES: 루키 · 브론즈 · 실버 · 골드 · 플래티넘 ·
// 다이아 · 레전드)을 그 시즌 마감 때 굳힌 업적 점수(owner_season_records.ach_score)로 정한다. 프로필 · 댓글 · 채팅에 붙는다.
// zod가 없는 서브패스(`@offside/contracts/owner-tier`)라 웹 · 앱 번들이 그대로 쓴다.
import { achGradeOf, type AchGrade } from './owner-team.js';

export const OWNER_TIERS = [
  'rookie',
  'bronze',
  'silver',
  'gold',
  'platinum',
  'diamond',
  'legend',
] as const;
export type OwnerTier = AchGrade['id'];

/** 마감 때 업적 점수로 티어를 정한다(점수가 없으면 루키). */
export const ownerTierOf = (achScore: number | null | undefined): OwnerTier =>
  achGradeOf(achScore ?? 0).grade.id;
