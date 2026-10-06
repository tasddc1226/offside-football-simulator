// T-11-034 업적이 바뀌었을 수 있다는 표시(achNudge.ts가 다음 화면에서 업적을 한 번 받아 비교한다). api/client · outbox가
// 쓰는 곳이라 업적 계산·등급 모듈을 끌어오지 않게 따로 둔다.
import { loadKey, saveKey } from '@offside/game/hof-store';

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

/** 업적이 바뀌었을 수 있는 쓰기(은퇴 업로드 · 팀 저장 · 경기 · 좋아요 · 닉네임) 뒤에 부른다. */
export function markAchDirty(): void {
  void saveKey(DIRTY_KEY, true);
  for (const fn of listeners) fn();
}
export const isAchDirty = (): boolean => loadKey<boolean>(DIRTY_KEY) === true;
export function clearAchDirty(): void {
  void saveKey(DIRTY_KEY, false);
}

/** 업적을 확인해도 되는 화면(홈·기록실·구단주·내 팀, 경기 결과를 보는 중이 아닐 때). 시트가 떠 있으면 닫힌 뒤로 미룬다. */
const ACH_SCREENS = new Set(['home', 'hof', 'owner', 'team']);
export const achCheckable = (screen: string, teamView: string, sheetOpen: boolean): boolean =>
  !sheetOpen && ACH_SCREENS.has(screen) && !(screen === 'team' && teamView === 'result');

/** 업적이 바뀔 수 있는 API 쓰기 경로(api/client가 성공한 쓰기마다 묻는다). 은퇴는 업로드 큐가 따로 표시한다. */
export const touchesAchievements = (path: string): boolean =>
  /^\/v1\/(owner-team(?:\/matches)?|teams\/[^/]+\/like|profile\/nickname)(?:\?|$)/.test(path);

/** 업적 탭에서 아직 보지 않은 새 업적 수(앱을 열 때 하단 점을 되살린다). */
export const achUnseenCount = (): number =>
  loadKey<{ unseen?: string[] }>(ACH_SEEN_KEY)?.unseen?.length ?? 0;
