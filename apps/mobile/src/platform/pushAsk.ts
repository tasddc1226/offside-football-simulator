// T-11-509 알림 권유. 홈 카드 · 친구 화면에 더해 알림이 쓸모 있는 순간(은퇴 리포트 · 판매 등록 · 구단 만들기)에 한 번씩 묻고,
// 권유가 보였는지 · 받기 · 나중에 · OS 결과를 앱 분석에 남긴다. 받기를 고르면(허용 · 거절 모두) 어디서도 다시 권하지 않는다.
import { Alert } from 'react-native';
import type { PushAskPlace, PushAskResult } from '@offside/app-core/analytics-native';
import { pushText as L } from '@offside/app-core/i18n/ko/push';
import { nativeAnalytics } from '../analytics';
import { pushRegistration, pushState } from './push';
import { checkPushOffer, dismissPushOffer, pushOffer, snoozePushOffer } from './pushOffer';
import { kv } from './setup';

/** 순간 권유 사이 최소 간격(어느 곳에서든 '나중에'를 고른 뒤). */
export const PUSH_ASK_GAP_MS = 3 * 24 * 60 * 60 * 1000;
const LAST = 'offside_push_ask_last';
const askedKey = (place: PushAskPlace) => `offside_push_ask_${place}`;
type Moment = Exclude<PushAskPlace, 'home' | 'friends'>;

/** 순간 권유를 띄워도 되는가. 홈의 7일 보류와는 따로 곳마다 한 번, 서로 3일 간격을 둔다. */
export async function pushAskOpen(place: Moment): Promise<boolean> {
  if (pushOffer.handled || pushState.enabled || pushState.busy) return false;
  if (kv.getBoolean(askedKey(place))) return false;
  if (Date.now() - (kv.getNumber(LAST) ?? 0) < PUSH_ASK_GAP_MS) return false;
  await checkPushOffer();
  return pushOffer.eligible && !pushState.enabled;
}

const resultOf = (): PushAskResult =>
  pushState.enabled
    ? 'granted'
    : pushState.failed
      ? 'failed'
      : pushState.blocked
        ? 'blocked'
        : 'denied';

export const trackPushAskView = (place: PushAskPlace) => nativeAnalytics.pushAsk('view', place);

/** 받기: OS 권한을 묻고 기기를 등록한다. 등록이 실패한 경우만 다음에 다시 권한다. */
export async function acceptPushAsk(place: PushAskPlace) {
  nativeAnalytics.pushAsk('accept', place);
  await pushRegistration.setEnabled(true);
  nativeAnalytics.pushAsk('result', place, resultOf());
  if (!pushState.failed) dismissPushOffer();
  if (place !== 'home' && place !== 'friends') kv.set(askedKey(place), true);
}

/** 나중에: 홈 · 친구는 기존처럼 7일 보류, 순간 권유는 그곳을 다시 묻지 않는다. 둘 다 다음 순간 권유까지 3일을 둔다. */
export function laterPushAsk(place: PushAskPlace) {
  nativeAnalytics.pushAsk('later', place);
  kv.set(LAST, Date.now());
  if (place === 'home' || place === 'friends') snoozePushOffer();
  else kv.set(askedKey(place), true);
}

const ALERT: Record<Exclude<Moment, 'retire'>, () => [string, string]> = {
  sell: () => [L.askSellTitle, L.askSellBody],
  club: () => [L.askClubTitle, L.askClubBody],
};

/** 판매 등록 · 구단 만들기가 성공한 뒤 확인 창으로 묻는다. 안내 토스트와 겹치지 않게 조금 뒤에 띄운다. */
export async function askPushAfter(place: Exclude<Moment, 'retire'>) {
  if (!(await pushAskOpen(place))) return;
  setTimeout(() => {
    if (pushOffer.handled || pushState.enabled) return;
    const [title, body] = ALERT[place]();
    trackPushAskView(place);
    Alert.alert(title, body, [
      { text: L.askLater, style: 'cancel', onPress: () => laterPushAsk(place) },
      {
        text: L.askOn,
        onPress: () =>
          void acceptPushAsk(place).then(() => {
            if (pushState.failed && pushState.message) Alert.alert(pushState.message);
          }),
      },
    ]);
  }, 700);
}
