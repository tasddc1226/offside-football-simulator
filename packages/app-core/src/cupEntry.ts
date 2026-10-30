// T-11-443 컵 신청 카드(웹 cup/CupEntry.svelte · 앱 owner/TeamCup.tsx) — 신청 전 확인 창의 줄과, 신청할 수 없는 이유에서
// 팀 편성으로 바로 가는 버튼. 이유 판정은 서버(eligibility)가 하고 여기서는 버튼 문구만 고른다.
import type { CupMeResponse, CupResponse } from './api/cup.js';
import { cupText as L } from './i18n/ko/cup.js';

/** 편성을 고치면 풀리는 이유면 그 버튼 문구, 아니면(정원 · 기간 · 다른 구간 신청) null. */
export function cupEntryTeamAction(
  e: CupMeResponse['eligibility'] | null | undefined,
): string | null {
  if (!e || e.ok) return null;
  if (e.reason === 'no-team') return L.toMakeTeam;
  if (e.reason === 'not-enough' || e.reason === 'listed' || e.reason === 'over-cap')
    return L.toLineup;
  return null;
}

/** 신청 확인 창의 줄: 선발 잠금, 구간 상한(있으면), 접수 중 취소 가능. */
export function cupEnterConfirmLines(cup: Pick<CupResponse['cup'], 'ovrMax'>): string[] {
  return [
    L.enterLockNote,
    ...(cup.ovrMax != null ? [L.divisionLockNote({ cap: cup.ovrMax })] : []),
    L.enterAskWithdraw,
  ];
}
