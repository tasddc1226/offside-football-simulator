// T-11-455 은퇴 전면광고(AdMob). 은퇴할 수 있는 나이가 되면 미리 불러 두고, 은퇴 버튼을 누른 순간 준비돼 있을 때만 띄운다.
// 은퇴 리포트를 읽는 도중에 늦게 뜨지 않게, 준비되지 않았으면 이번 은퇴는 건너뛴다.
// 광고 제거 구매자 · 동의 실패 · 단위 없음은 부르지 않는다. 비개인화 광고만 요청하고 개발 빌드는 구글 테스트 광고를 쓴다.
import { Platform } from 'react-native';
import { AdEventType, InterstitialAd, TestIds } from 'react-native-google-mobile-ads';
import { proxy } from 'valtio';
import { askConsent } from './adConsent';
import { adFree, adsOff } from './adFree';
import { countInterstitial } from './adUsage';

/** ios·android-retire-interstitial */
const UNIT = __DEV__
  ? TestIds.INTERSTITIAL
  : Platform.select({
      ios: 'ca-app-pub-3797087216173591/7389473145',
      android: 'ca-app-pub-3797087216173591/5709559962',
    });
/** 불러 둔 광고는 1시간 동안 쓸 수 있다. 여유를 두고 50분이 지나면 다시 부른다. */
const FRESH_MS = 50 * 60_000;
/** 불러오기에 실패하면 이 시간 동안 다시 부르지 않는다. */
const RETRY_MS = 5 * 60_000;
/** 은퇴를 짧은 간격으로 거듭해도 전면광고는 이 간격 안에 한 번만 띄운다. */
const GAP_MS = 3 * 60_000;

/** 전면광고가 떠 있는 동안 true. 리뷰 요청 창은 광고가 닫힐 때까지 기다린다. */
export const interstitial = proxy({ showing: false });

let ready: InterstitialAd | null = null;
let loadedAt = 0;
let loading = false;
let failedAt = -Infinity;
let shownAt = -Infinity;

/** 은퇴할 수 있을 때 부른다. 이미 쓸 수 있는 광고가 있거나 불러오는 중이면 아무것도 하지 않는다. */
export function prepareRetireAd(now = Date.now()) {
  if (!UNIT || adsOff(adFree) || loading) return;
  if (ready && now - loadedAt < FRESH_MS) return;
  if (now - failedAt < RETRY_MS) return;
  loading = true;
  ready = null;
  void askConsent().then((ok) => {
    if (!ok) {
      loading = false;
      failedAt = Date.now();
      return;
    }
    const ad = InterstitialAd.createForAdRequest(UNIT, { requestNonPersonalizedAdsOnly: true });
    const offs = [
      ad.addAdEventListener(AdEventType.LOADED, () => {
        offs.forEach((off) => off());
        loading = false;
        ready = ad;
        loadedAt = Date.now();
      }),
      ad.addAdEventListener(AdEventType.ERROR, () => {
        offs.forEach((off) => off());
        loading = false;
        failedAt = Date.now();
      }),
    ];
    ad.load();
  });
}

/** 은퇴 직후 부른다. 준비된 광고가 있으면 띄우고 true를 돌려준다. 한 번 쓴 광고는 버린다. */
export function showRetireAd(now = Date.now()): boolean {
  const ad = ready;
  ready = null;
  if (!ad || adsOff(adFree) || now - loadedAt >= FRESH_MS || now - shownAt < GAP_MS) return false;
  shownAt = now;
  interstitial.showing = true;
  const offs = [
    // T-11-486a 실제로 뜬 것만 센다.
    ad.addAdEventListener(AdEventType.OPENED, countInterstitial),
    ad.addAdEventListener(AdEventType.CLOSED, done),
    ad.addAdEventListener(AdEventType.ERROR, done),
  ];
  function done() {
    offs.forEach((off) => off());
    interstitial.showing = false;
  }
  ad.show().catch(done);
  return true;
}
