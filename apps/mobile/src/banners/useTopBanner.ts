// 화면 위 알림 배너는 한 번에 하나만 띄운다 — 새 버전(OTA) > 새 소식. 스토어 업데이트는 OS 팝업이다(T-11-464).
// 소식 화면을 보고 있을 때는 새 소식 배너를 띄우지 않는다.
import { useSnapshot } from 'valtio';
import { hiddenPost } from '../platform/storeText';
import { useUpdatePending } from '../platform/updates';
import { appState, newsState } from '../store';

export function useTopBanner(): 'update' | 'news' | null {
  const update = useUpdatePending();
  const { post } = useSnapshot(newsState);
  const { screen } = useSnapshot(appState);
  if (update) return 'update';
  if (post && screen !== 'board' && !hiddenPost(post)) return 'news';
  return null;
}
