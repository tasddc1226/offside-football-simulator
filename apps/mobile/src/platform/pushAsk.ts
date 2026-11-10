// T-11-509 알림 권유. 홈 카드 · 친구 화면에 더해 알림이 쓸모 있는 순간(은퇴 리포트 · 판매 등록 · 구단 만들기)에 한 번씩 묻고,
// 권유가 보였는지 · 받기 · 나중에 · OS 결과를 앱 분석에 남긴다. 받기를 고르면(허용 · 거절 모두) 어디서도 다시 권하지 않는다.
// "받기" 다음에는 OS 창보다 먼저 받고 싶은 알림을 고르는 창(components/PushPicker)이 뜬다. 고른 뒤에 OS 권한을 묻는다.
import { proxy } from 'valtio';
import type { PushAskPlace, PushAskResult } from '@offside/app-core/analytics-native';
import {
  DEFAULT_PUSH_PICKS,
  PUSH_GROUPS,
  pickedGroups,
  picksToTopics,
  type PushPicks,
} from '@offside/app-core/pushTopics';
import { pushText as L } from '@offside/app-core/i18n/ko/push';
import { nativeAnalytics } from '../analytics';
import { pushRegistration, pushState } from './push';
import { checkPushOffer, dismissPushOffer, pushOffer, snoozePushOffer } from './pushOffer';
import { savePushTopics } from './pushPreferences';
import { kv } from './setup';
import { toast } from '../game/host';

/** 순간 권유 사이 최소 간격(어느 곳에서든 '나중에'를 고른 뒤). */
export const PUSH_ASK_GAP_MS = 3 * 24 * 60 * 60 * 1000;
const LAST = 'offside_push_ask_last';
const PICKS = 'offside_push_picks';
const askedKey = (place: PushAskPlace) => `offside_push_ask_${place}`;
type Moment = Exclude<PushAskPlace, 'home' | 'friends' | 'quiet'>;

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

/** 받고 싶은 알림을 고르는 창. 한 번에 하나만 열린다. */
export const pushPicker = proxy({
  open: false,
  place: 'home' as PushAskPlace,
  title: '',
  body: '',
});
let settle: ((picks: PushPicks | null) => void) | undefined;
function pick(place: PushAskPlace, title: string, body = ''): Promise<PushPicks | null> {
  settle?.(null);
  return new Promise((resolve) => {
    settle = resolve;
    Object.assign(pushPicker, { open: true, place, title, body });
  });
}
/** 선택 창이 부른다. null은 고르지 않고 닫은 것이다. */
export function closePushPicker(picks: PushPicks | null) {
  pushPicker.open = false;
  const done = settle;
  settle = undefined;
  done?.(picks);
}

const storedPicks = (): PushPicks | null => {
  try {
    const raw = JSON.parse(kv.getString(PICKS) ?? 'null') as Partial<PushPicks> | null;
    if (!raw) return null;
    return Object.fromEntries(
      PUSH_GROUPS.map((g) => [g, raw[g] ?? DEFAULT_PUSH_PICKS[g]]),
    ) as PushPicks;
  } catch {
    return null;
  }
};
/**
 * 고른 알림을 계정에 저장한다. 알림이 켜진 뒤에만 서버에 쓴다 — OS에서 거절하면 기기에만 두었다가 나중에 켤 때 쓴다.
 * 설정 화면에서 전체 알림을 켤 때도 부른다.
 */
export async function applyPushPicks() {
  const picks = storedPicks();
  if (!picks || !pushState.enabled) return;
  if (await savePushTopics(picksToTopics(picks))) kv.remove(PICKS);
}

/** 고른 뒤: OS 권한을 묻고 기기를 등록한다. 등록이 실패한 경우만 다음에 다시 권한다. */
async function enableWith(place: PushAskPlace, picks: PushPicks) {
  nativeAnalytics.pushAsk('pick', place, undefined, pickedGroups(picks));
  kv.set(PICKS, JSON.stringify(picks));
  await pushRegistration.setEnabled(true);
  nativeAnalytics.pushAsk('result', place, resultOf());
  if (!pushState.failed) dismissPushOffer();
  if (place !== 'home' && place !== 'friends') kv.set(askedKey(place), true);
  await applyPushPicks();
}

/**
 * 받기(홈 · 친구 · 은퇴 카드): 받고 싶은 알림을 고르는 창을 띄우고, 고르면 OS 권한을 묻는다.
 * 고르지 않고 닫으면 아무 일도 없다(카드는 그대로 남는다). 권한을 물었으면 true.
 */
export async function acceptPushAsk(place: PushAskPlace): Promise<boolean> {
  nativeAnalytics.pushAsk('accept', place);
  const picks = await pick(place, L.pickTitle);
  if (!picks) return false;
  await enableWith(place, picks);
  return true;
}

/** 나중에: 홈 · 친구는 기존처럼 7일 보류, 순간 권유는 그곳을 다시 묻지 않는다. 둘 다 다음 순간 권유까지 3일을 둔다. */
export function laterPushAsk(place: PushAskPlace) {
  nativeAnalytics.pushAsk('later', place);
  kv.set(LAST, Date.now());
  if (place === 'home' || place === 'friends') snoozePushOffer();
  else kv.set(askedKey(place), true);
}

const ASK: Record<Exclude<Moment, 'retire'>, () => [string, string]> = {
  sell: () => [L.askSellTitle, L.askSellBody],
  club: () => [L.askClubTitle, L.askClubBody],
  // 리그 결과 알림은 구단 만들기와 같은 안내(컵 접수 · 랭크 경기 결과)로 묻는다.
  league: () => [L.askClubTitle, L.askClubBody],
  cup: () => [L.askCupTitle, L.askCupBody],
};

/**
 * 판매 등록 · 구단 만들기 · 리그 신청 · 컵 접수가 성공한 뒤 선택 창으로 묻는다. 안내 토스트와 겹치지 않게 조금 뒤에 띄운다.
 * 창을 닫으면 '나중에', 고르면 받기다.
 */
export async function askPushAfter(place: Exclude<Moment, 'retire'>) {
  if (!(await pushAskOpen(place))) return;
  setTimeout(() => {
    if (pushOffer.handled || pushState.enabled || pushPicker.open) return;
    const [title, body] = ASK[place]();
    trackPushAskView(place);
    void pick(place, title, body).then(async (picks) => {
      if (!picks) return laterPushAsk(place);
      nativeAnalytics.pushAsk('accept', place);
      await enableWith(place, picks);
      if (pushState.failed && pushState.message) toast(pushState.message);
    });
  }, 700);
}
