// T-11-042 스토어 앱 업데이트 안내. 앱 버전(`1.<시즌>.<빌드>`)을 올린 스토어 빌드부터 OTA 런타임이 바뀌어 옛 빌드에는
// 새 번들이 가지 않는다 — 서버가 알려 준 버전보다 이 앱이 낮으면 스토어로 안내한다.
// T-11-464 화면 위 배너 대신 OS 기본 팝업(Alert)으로 묻는다. 최소 버전보다 낮으면 닫을 수 없고 앱으로 돌아올 때마다
// 다시 뜬다. 최신 버전보다 낮으면 '나중에'가 있고, 고른 뒤에는 그 버전으로 사흘 동안 다시 묻지 않는다.
// 이 앱의 버전은 expoConfig.version으로 읽는다: 버전도 fingerprint에 들어가 같은 런타임의 OTA 번들은 늘 설치된 앱과
// 같은 버전을 싣는다(새 네이티브 모듈 없이 1.0.0에도 OTA로 들어간다).
import Constants from 'expo-constants';
import { Alert, Linking, Platform } from 'react-native';
import { loadKey, saveKey } from '@offside/game/storage';
import { fetchAppVersion, storeUpdateNeed } from '@offside/app-core/api/appVersion';
import { shellMoreText } from '@offside/app-core/i18n/ko/shellMore';
import { storeUpdate } from '../store';

const SNOOZE = 'offside_store_update_snooze_v1';
const SNOOZE_MS = 3 * 24 * 3600_000;

const snoozed = (latest: string) => {
  const s = loadKey<{ version: string; until: number }>(SNOOZE);
  return !!s && s.version === latest && Date.now() < s.until;
};

export async function checkStoreUpdate(): Promise<void> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
  const r = await fetchAppVersion();
  if (!r.ok || storeUpdate.showing) return;
  const need = storeUpdateNeed(r.data, Platform.OS, Constants.expoConfig?.version);
  if (!need || (need.kind === 'suggest' && snoozed(need.latest))) return;
  storeUpdate.showing = true;
  const done = () => {
    storeUpdate.showing = false;
    // 스토어에 갔다가 업데이트하지 않고 돌아와도 권장 팝업은 사흘 동안 다시 띄우지 않는다.
    if (need.kind === 'suggest')
      saveKey(SNOOZE, { version: need.latest, until: Date.now() + SNOOZE_MS });
  };
  const update = {
    text: shellMoreText.storeUpdateBtn,
    onPress: () => {
      done();
      void Linking.openURL(need.url);
    },
  };
  Alert.alert(
    shellMoreText.storeUpdateTitle,
    need.kind === 'force' ? shellMoreText.storeUpdateForceBody : shellMoreText.storeUpdateBody,
    need.kind === 'force'
      ? [update]
      : [{ text: shellMoreText.storeUpdateLater, style: 'cancel', onPress: done }, update],
    { cancelable: false },
  );
}
