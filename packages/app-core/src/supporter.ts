// T-11-818 서포터 뱃지 그리기 값(웹 SupporterBadge.svelte · 앱 SupporterBadge.tsx가 같이 쓴다).
import type { SupporterTier } from '@offside/contracts/membership';
import { supporterText as L } from './i18n/ko/supporter';

export type SupporterPill = { tier: SupporterTier; text: string; label: string };

/**
 * 응답의 서포터 단계 → 뱃지 글자 · 읽기 라벨. 단계가 없는데 구독 중(member)이면 1단계로 본다(단계를 아직 싣지 않은 응답).
 * 구독 중이 아니면 null.
 */
export function supporterPill(
  tier: SupporterTier | null | undefined,
  member = false,
): SupporterPill | null {
  const t = tier ?? (member ? 1 : null);
  if (!t) return null;
  return { tier: t, text: L.pill({ tier: t }), label: L.label({ tier: t }) };
}
