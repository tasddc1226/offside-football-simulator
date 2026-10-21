// T-11-439 은퇴 리포트의 꾸미기 버튼이 편집기를 열기 전에 아는 잠김(B5). 버튼만을 위해 서버를 부르지 않는다:
// 편집기가 열 때 받은 정책(GET 한 번)과 저장 결과를 이번 접속 동안 기억하고, 서버에 없는 옛 기록은 이 기기 영수증으로 본다.
// 모르면(아직 안 열어 봄) 남은 1회로 보여 준다. 편집기 모듈(retiredLook.ts)과 달리 첫 화면 번들에 실려도 가볍다.
import type { RetiredLookPolicy } from '@offside/contracts';
import { loadKey } from '@offside/game/storage';
import type { LegendView } from './state.js';
import { retiredLookText as L } from './i18n/ko/retiredLook.js';

export type LookLock = RetiredLookPolicy['lockedReason'];

/** T-11-243 서버와 같은 그림 회차(RETIRED_LOOK_ROUND). 도트 캐릭터 때 쓴 영수증은 회차가 없어 한 번 더 바꿀 수 있다. */
export const LOOK_ROUND = 2;
export type LocalReceipt = { used: true; look: string | null; round?: number };
export const receiptKey = (avatarId: string) => `ft_retired_look:${avatarId}`;
export const spentReceipt = (r: LocalReceipt | null | undefined): boolean =>
  !!r?.used && (r.round ?? 1) >= LOOK_ROUND;

/** 커리어 id → 이번 접속에서 확인한 잠김(null이면 바꿀 수 있다). */
const seen: Record<string, LookLock> = {};

export function rememberLookLock(careerId: string, lock: LookLock) {
  seen[careerId] = lock;
}

/** 버튼이 아는 잠김. undefined면 아직 모른다(남은 1회로 보여 준다). */
export function retiredLookLockOf(v: Pick<LegendView, 'avatarId' | 'own'>): LookLock | undefined {
  if (!v.avatarId) return undefined;
  if (v.avatarId in seen) return seen[v.avatarId];
  // 서버에 없는 옛 기록은 이 기기 영수증이 정본이다.
  if (v.own && !v.own.id)
    return spentReceipt(loadKey<LocalReceipt>(receiptKey(v.avatarId))) ? 'used' : null;
  return undefined;
}

export const lookButtonLabel = (lock: LookLock | undefined): string =>
  lock === 'used' ? L.buttonUsed : lock === 'transferred' ? L.buttonTransferred : L.button;
