import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { proxy } from 'valtio';
import { kv } from './setup';

const HANDLED = 'offside_push_offer_handled';
export const pushOffer = proxy({
  handled: kv.getBoolean(HANDLED) ?? false,
  eligible: false,
});
let checked: Promise<void> | undefined;

/** 권한 상태만 읽는다. 홈을 여는 것만으로 OS 권한을 요청하거나 기기를 등록하지 않는다. */
export function checkPushOffer() {
  checked ??= (async () => {
    if (pushOffer.handled || (Platform.OS !== 'ios' && Platform.OS !== 'android')) return;
    try {
      const permission = await Notifications.getPermissionsAsync();
      pushOffer.eligible = permission.granted || permission.status === 'undetermined';
    } catch {
      pushOffer.eligible = false;
    }
  })();
  return checked;
}

/** 안내 닫기·수신 선택·설정에서 끄기는 다시 홈 안내를 띄우지 않는다. */
export function dismissPushOffer() {
  kv.set(HANDLED, true);
  pushOffer.handled = true;
}
