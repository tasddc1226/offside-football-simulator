// 보상형 광고(AdMob) 공용 재생. 후보 잠재력(T-11-118, 후보 다시 뽑기 T-11-154도 같은 단위)·잠재력 엿보기·강화가 쓴다.
// T-11-117 두 곳의 실적을 따로 보려고 광고 단위를 나눴다(재생 흐름은 같다).
// 비개인화 광고만 요청하고, 동의는 배너와 같은 UMP를 쓴다. 개발 빌드는 구글 테스트 광고를 쓴다.
// T-11-558 버튼이 보이면 SDK 미리 불러오기(Ad Preloading)로 단위마다 1개를 준비해 두고, 누르면 바로 띄운다.
// 준비된 광고가 없거나 미리 불러오기를 못 쓰면 예전처럼 누른 뒤에 불러온다.
import { Platform } from 'react-native';
import {
  AdEventType,
  AdFormat,
  AdPoolPresets,
  AdPools,
  RewardedAd,
  RewardedAdEventType,
  TestIds,
  type AdPool,
} from 'react-native-google-mobile-ads';
import { adText } from '@offside/app-core/i18n/ko/ad';
import { askConsent } from './adConsent';
import { adFree, adsOff } from './adFree';
import { countReward } from './adUsage';

/** AdMob 보상형 광고 단위. 단위가 없는 플랫폼은 광고 제거 구매자만 보상을 받는다. */
const UNITS = {
  candidates: {
    ios: 'ca-app-pub-3797087216173591/3708867561',
    android: 'ca-app-pub-3797087216173591/3204550669',
  },
  /** ios·android-scout-peek-rewarded */
  peek: {
    ios: 'ca-app-pub-3797087216173591/6888876318',
    android: 'ca-app-pub-3797087216173591/3915228615',
  },
  /** ios·android-potential-boost-rewarded */
  boost: {
    ios: 'ca-app-pub-3797087216173591/9962450572',
    android: 'ca-app-pub-3797087216173591/7873589266',
  },
};
type RewardPlacement = keyof typeof UNITS;
const unitOf = (p: RewardPlacement) => (__DEV__ ? TestIds.REWARDED : Platform.select(UNITS[p]));

/** 광고를 볼 수 있거나(단위 있음) 광고 없이 받을 수 있으면(광고 제거) 버튼을 보인다. */
export const rewardAvailable = (p: RewardPlacement) => adsOff(adFree) || !!unitOf(p);
/** 보상 버튼 종류 — 광고 제거 구매자는 'free', 광고를 볼 수 있으면 'ad', 둘 다 아니면 null. owned는 화면이 구독한 값. */
export const rewardOffer = (p: RewardPlacement, owned: boolean): 'free' | 'ad' | null =>
  owned ? 'free' : unitOf(p) ? 'ad' : null;

/**
 * 광고를 띄운 결과 — 끝까지 봐서 보상(earned), 보다가 닫음(closed), 불러오기·보여 주기 실패(failed).
 * 불러오지 못한 광고(게재 제한 · 광고 없음 · 네트워크)를 '끝까지 안 봤다'로 안내하지 않으려고 나눈다.
 */
type WatchResult = 'earned' | 'closed' | 'failed';

/** 보상형 광고 하나를 띄우는 데 필요한 것 — 바로 만든 광고와 미리 불러 둔 광고가 같이 쓴다. */
type Playable = Pick<RewardedAd, 'show' | 'addAdEventListener'>;

/** 띄우고 닫힐 때까지 기다린다. loaded가 있으면 LOADED를 기다렸다가 띄우고(바로 만든 광고), 없으면 바로 띄운다. */
function play(ad: Playable, load?: () => boolean): Promise<WatchResult> {
  return new Promise((resolve) => {
    let earned = false;
    let shown = false;
    const offs = [
      ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
        earned = true;
      }),
      ad.addAdEventListener(AdEventType.OPENED, () => {
        shown = true;
      }),
      ad.addAdEventListener(AdEventType.CLOSED, () => done()),
      ad.addAdEventListener(AdEventType.ERROR, () => done()),
    ];
    // 불러오기가 끝나지 않으면(네트워크) 20초에서 끊는다. 보여 주는 중이면 닫힐 때 끝난다.
    let timer: ReturnType<typeof setTimeout> | undefined;
    function done() {
      clearTimeout(timer);
      offs.forEach((off) => off());
      resolve(earned ? 'earned' : shown ? 'closed' : 'failed');
    }
    if (load) {
      offs.push(
        ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
          ad.show().catch(() => done());
        }),
      );
      timer = setTimeout(() => !load() && done(), 20_000);
    } else ad.show().catch(() => done());
  });
}

function watch(unit: string): Promise<WatchResult> {
  const ad = RewardedAd.createForAdRequest(unit, { requestNonPersonalizedAdsOnly: true });
  const result = play(ad, () => ad.loaded);
  ad.load();
  return result;
}

/** 단위마다 미리 불러오기 풀 하나. 만들지 못하면 null로 남겨 이번 실행에서는 다시 만들지 않는다. */
const pools = new Map<string, Promise<AdPool | null>>();
/** 풀 만들기 · 꺼내기가 이 시간 안에 끝나지 않으면 기다리지 않고 바로 불러온다. */
const POOL_WAIT_MS = 3_000;

const within = <T>(p: Promise<T>, ms: number, late?: (v: T) => void) =>
  new Promise<T | null>((resolve) => {
    let over = false;
    const timer = setTimeout(() => {
      over = true;
      resolve(null);
    }, ms);
    void p.then((v) => {
      if (over) return late?.(v);
      clearTimeout(timer);
      resolve(v);
    });
  });

function poolOf(unit: string) {
  let pool = pools.get(unit);
  if (!pool) {
    pool = askConsent()
      .then((ok) =>
        ok
          ? AdPools.create(
              AdPoolPresets.fullscreen(AdFormat.REWARDED, unit, {
                requestOptions: { requestNonPersonalizedAdsOnly: true },
              }),
            )
          : null,
      )
      .catch(() => null);
    pools.set(unit, pool);
  }
  return pool;
}

/** 보상 버튼이 보일 때 부른다. 광고 제거 구매자 · 단위 없음은 부르지 않는다. 이미 준비 중이면 아무것도 하지 않는다. */
export function prepareReward(p: RewardPlacement) {
  const unit = unitOf(p);
  if (!unit || adsOff(adFree)) return;
  void poolOf(unit);
}

/** 미리 불러 둔 광고를 띄운다. 꺼낼 광고가 없거나 띄우지 못하면 null(바로 불러오기로 넘어간다). */
async function watchPooled(unit: string): Promise<WatchResult | null> {
  const pool = await within(poolOf(unit), POOL_WAIT_MS);
  if (!pool) return null;
  const r = await within(pool.poll(), POOL_WAIT_MS, (late) => {
    if (late.status === 'filled') late.ad.destroy();
  });
  if (r?.status !== 'filled') return null;
  const ad = r.ad;
  if (ad.format !== AdFormat.REWARDED || ad.isStaleByPolicy()) {
    ad.destroy();
    return null;
  }
  const result = await play(ad);
  ad.destroy();
  return result === 'failed' ? null : result;
}

/**
 * 보상을 받으면 onEarned를 부르고 ''를, 못 받으면 보여 줄 안내를 돌려준다(동의·불러오기 실패 = 불러올 수 없음,
 * 끝까지 보지 않음 = skipped).
 * 광고 제거 구매자는 광고 없이 바로 받는다.
 */
export async function claimReward(
  p: RewardPlacement,
  onEarned: () => void,
  skipped: string,
): Promise<string> {
  const free = adsOff(adFree);
  if (!free) {
    const unit = unitOf(p);
    if (!unit || !(await askConsent())) return adText.rewardedUnavailable;
    const result = (await watchPooled(unit)) ?? (await watch(unit));
    if (result === 'failed') return adText.rewardedUnavailable;
    if (result === 'closed') return skipped;
  }
  countReward(p, free);
  onEarned();
  return '';
}
