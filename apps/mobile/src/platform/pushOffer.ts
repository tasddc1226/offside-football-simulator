import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { proxy } from 'valtio';
import { kv } from './setup';

const HANDLED = 'offside_push_offer_handled';
const SNOOZED_UNTIL = 'offside_push_offer_snoozed_until';
export const PUSH_OFFER_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;
export const pushOffer = proxy({
  handled: kv.getBoolean(HANDLED) ?? false,
  snoozedUntil: kv.getNumber(SNOOZED_UNTIL) ?? 0,
  eligible: false,
});
let checked: Promise<void> | undefined;

/** 권한 상태만 읽는다. 홈을 여는 것만으로 OS 권한을 요청하거나 기기를 등록하지 않는다. */
export function checkPushOffer() {
  if (
    pushOffer.handled ||
    Date.now() < pushOffer.snoozedUntil ||
    (Platform.OS !== 'ios' && Platform.OS !== 'android')
  ) {
    pushOffer.eligible = false;
    return Promise.resolve();
  }
  checked ??= (async () => {
    try {
      const permission = await Notifications.getPermissionsAsync();
      // Android 13+는 첫 요청 전에도 areNotificationsEnabled=false라 status=denied를 반환한다.
      // 명시적인 수신 선택은 HANDLED로 보존하고, OS가 재요청을 막은 기기는 안내하지 않는다.
      pushOffer.eligible =
        permission.granted ||
        permission.status === 'undetermined' ||
        (Platform.OS === 'android' && permission.status === 'denied' && permission.canAskAgain);
    } catch {
      pushOffer.eligible = false;
    }
  })();
  return checked;
}

/** 수신 선택·설정에서 끄기는 다시 홈 안내를 띄우지 않는다. 이전 버전의 종료 기록도 유지한다. */
export function dismissPushOffer() {
  kv.set(HANDLED, true);
  pushOffer.handled = true;
}

/** '나중에'는 기기에 7일간 보류를 저장한다. 만료 뒤 홈 방문 시 권한 상태를 다시 확인한다. */
export function snoozePushOffer() {
  const until = Date.now() + PUSH_OFFER_SNOOZE_MS;
  kv.set(SNOOZED_UNTIL, until);
  pushOffer.snoozedUntil = until;
  pushOffer.eligible = false;
  checked = undefined;
}
