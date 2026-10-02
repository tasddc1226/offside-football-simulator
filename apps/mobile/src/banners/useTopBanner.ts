// 화면 위 알림 배너는 한 번에 하나만 띄운다 — 스토어 업데이트(T-11-042) > 새 버전(OTA) > 새 소식.
// 소식 화면을 보고 있을 때는 새 소식 배너를 띄우지 않는다.
import { useSnapshot } from 'valtio';
import { useStoreUpdateShown } from '../platform/storeUpdate';
import { useUpdatePending } from '../platform/updates';
import { appState, newsState } from '../store';

export function useTopBanner(): 'store' | 'update' | 'news' | null {
  const store = useStoreUpdateShown();
  const update = useUpdatePending();
  const { post } = useSnapshot(newsState);
  const { screen } = useSnapshot(appState);
  if (store) return 'store';
  if (update) return 'update';
  if (post && screen !== 'board') return 'news';
  return null;
}
