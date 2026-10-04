// T-11-042 스토어 앱 업데이트 안내. 앱 버전(`1.<시즌>.<빌드>`)을 올린 스토어 빌드부터 OTA 런타임이 바뀌어 옛 빌드에는
// 새 번들이 가지 않는다 — 서버가 알려 준 최소 버전보다 이 앱이 낮으면 스토어로 안내한다(StoreUpdateBanner).
// 이 앱의 버전은 expoConfig.version으로 읽는다: 버전도 fingerprint에 들어가 같은 런타임의 OTA 번들은 늘 설치된 앱과
// 같은 버전을 싣는다(새 네이티브 모듈 없이 1.0.0에도 OTA로 들어간다).
import Constants from 'expo-constants';
import { Linking, Platform } from 'react-native';
import { useSnapshot } from 'valtio';
import { fetchAppVersion, storeUpdateUrl } from '@offside/app-core/api/appVersion';
import { storeUpdate } from '../store';

export async function checkStoreUpdate(): Promise<void> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
  const r = await fetchAppVersion();
  if (r.ok) storeUpdate.url = storeUpdateUrl(r.data, Platform.OS, Constants.expoConfig?.version);
}

export const openStore = () => {
  if (storeUpdate.url) void Linking.openURL(storeUpdate.url);
};

/** 스토어 업데이트 배너를 띄울 때다(배너 사이 순서는 banners/useTopBanner). */
export const useStoreUpdateShown = () => {
  const s = useSnapshot(storeUpdate);
  return !!s.url && !s.closed;
};
