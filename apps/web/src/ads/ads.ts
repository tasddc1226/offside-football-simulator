// T-11-061 웹 광고(AdSense) 스위치·로더·세션 기록(docs/tracking/web-ads-plan.md 4.2).
// 빌드 환경변수가 없으면 칸을 그리지 않는다. 운영 호스트에서만 실제 광고를 요청하고, 스크립트는 첫 칸이 보일 때 한 번만 불러온다.
import type { AdPlace } from '@offside/app-core/adPolicy';

const env = import.meta.env;
export const client = String(env.VITE_ADSENSE_CLIENT ?? '');
const hostname = String(env.VITE_ADSENSE_HOSTNAME ?? '');
const slots: Partial<Record<AdPlace, string>> = (() => {
  try {
    return JSON.parse(String(env.VITE_ADSENSE_SLOTS || '{}')) as Partial<Record<AdPlace, string>>;
  } catch {
    return {};
  }
})();
/** 로컬 개발에서 광고 대신 자리 표시만 그린다(승인 전 위치 확인용). */
export const preview = env.DEV && env.VITE_ADSENSE_PREVIEW === '1';

export function enabled(): boolean {
  return /^ca-pub-\d{16}$/.test(client) && hostname !== '' && window.location.hostname === hostname;
}
/** 광고 단위 ID. AdSense에서 위치별로 만든 단위를 VITE_ADSENSE_SLOTS({"records-bottom":"123…"})로 넘긴다. */
export const slotOf = (place: AdPlace): string | undefined =>
  /^\d{6,}$/.test(slots[place] ?? '') ? slots[place] : undefined;

type AdsWindow = Window &
  typeof globalThis & { adsbygoogle?: unknown[] & { requestNonPersonalizedAds?: number } };
let loading: Promise<void> | null = null;
function load(): Promise<void> {
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`;
    script.onload = () => resolve();
    // 광고 차단기에 막히면 이 탭에서는 다시 시도하지 않는다.
    script.onerror = () => reject(new Error('adsense blocked'));
    document.head.append(script);
  });
  return loading;
}

// 위치별 마지막 요청 시각. 안 채워진 위치는 Infinity로 둬 이 세션에서 다시 요청하지 않는다.
const lastShown = new Map<AdPlace, number>();
export const lastShownOf = (place: AdPlace) => lastShown.get(place);
export const markUnfilled = (place: AdPlace) => lastShown.set(place, Infinity);

/** 칸 하나를 채워 달라고 요청한다. 맞춤 광고 동의는 아직 받지 않아(기획 7절 2) 비개인화 광고만 요청한다. */
export async function request(place: AdPlace, ins: HTMLElement): Promise<boolean> {
  lastShown.set(place, Date.now());
  try {
    const w = window as AdsWindow;
    w.adsbygoogle ??= [];
    w.adsbygoogle.requestNonPersonalizedAds = 1;
    await load();
    // 그새 화면을 떠났으면 요청만 건너뛴다(안 채워짐으로 치지 않는다).
    if (!ins.isConnected) return true;
    w.adsbygoogle.push({});
    return true;
  } catch {
    return false;
  }
}
