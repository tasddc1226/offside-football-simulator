// T-11-034 업적이 바뀌었을 수 있다는 표시(achNudge.ts가 다음 화면에서 업적을 한 번 받아 비교한다). api/client · outbox가
// 쓰는 곳이라 업적 계산·등급 모듈을 끌어오지 않게 따로 둔다.
import { loadKey, saveKey } from '@offside/game/storage';

const DIRTY_KEY = 'ft_ach_dirty';
/** 이 기기가 마지막으로 본 시즌 업적(achNudge.ts AchSeen). */
export const ACH_SEEN_KEY = 'ft_ach_seen';
/** 업로드 큐(outbox.ts) — 웹은 큐 모듈을 지연 로드하니 achNudge가 저장값만 읽게 키를 여기 둔다. */
export const OUTBOX_KEY = 'ft_outbox';

const listeners = new Set<() => void>();
/** 표시가 생길 때 알림(화면을 옮기지 않아도 은퇴 업로드가 끝나면 바로 확인하게). 해제 함수를 돌려준다. */
export function onAchDirty(fn: () => void): () => void {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

/** 업적이 바뀌었을 수 있는 쓰기(은퇴 업로드 · 팀 저장 · 경기 · 좋아요 · 닉네임 · 카드 강화) 뒤에 부른다. */
export function markAchDirty(): void {
  void saveKey(DIRTY_KEY, true);
  for (const fn of listeners) fn();
}
export const isAchDirty = (): boolean => loadKey<boolean>(DIRTY_KEY) === true;
export function clearAchDirty(): void {
  void saveKey(DIRTY_KEY, false);
}

let holds = 0;
/** 강화 창처럼 그 안에서 쓰기가 이어지는 창이 떠 있는 동안인지. */
export const achHeld = (): boolean => holds > 0;
/**
 * 창이 열린 동안 업적 확인을 미룬다. 앱은 모달 위에 시트 모달을 또 열면 iOS에서 화면이 멈추고, 강화처럼 연달아 쓰는 창은
 * 시도마다 업적을 다시 받게 된다. 돌려준 함수로 풀면 미룬 확인을 한 번 한다.
 */
export function holdAchCheck(): () => void {
  holds++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds--;
    if (holds === 0) for (const fn of listeners) fn();
  };
}

/** 업적을 확인해도 되는 화면(홈·기록실·구단주·내 팀, 경기 결과를 보는 중이 아닐 때). 시트나 보류 중인 창이 떠 있으면 닫힌 뒤로 미룬다. */
const ACH_SCREENS = new Set(['home', 'hof', 'owner', 'team']);
export const achCheckable = (screen: string, teamView: string, sheetOpen: boolean): boolean =>
  !sheetOpen &&
  !achHeld() &&
  ACH_SCREENS.has(screen) &&
  !(screen === 'team' && teamView === 'result');

/** 업적이 바뀔 수 있는 API 쓰기 경로(api/client가 성공한 쓰기마다 묻는다). 은퇴는 업로드 큐가 따로 표시한다. */
export const touchesAchievements = (path: string): boolean =>
  /^\/v1\/(owner-team(?:\/matches|\/coach)?|managers\/[^/]+\/finish|teams\/[^/]+\/like|profile\/nickname|cards\/[^/]+\/enhance)(?:\?|$)/.test(
    path,
  );

/** 업적 탭에서 아직 보지 않은 새 업적 수(앱을 열 때 하단 점을 되살린다). */
export const achUnseenCount = (): number =>
  loadKey<{ unseen?: string[] }>(ACH_SEEN_KEY)?.unseen?.length ?? 0;
