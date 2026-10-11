// T-11-195 메타 픽셀(웹 광고 측정). 해외 유입 광고가 '들어와서 실제로 플레이한 사람'을 찾을 수 있게
// 커리어 시작·첫 시즌 완료·App Store 클릭만 보낸다. GA4와 같은 동의 카드에서 함께 묻지만 동의 값은 따로 저장한다
// (GA4만 동의했던 이용자에게 광고 측정을 다시 묻는다). 동의 전·거절 시에는 스크립트를 불러오지 않고, 철회하면
// 이 브라우저의 _fbp·_fbc 쿠키를 지운다. 이름·커리어 ID·이메일은 보내지 않고 자동 수집(버튼·페이지 정보)도 끈다.
import { enabled as analyticsEnabled } from './config.js';
import { landingClickId } from '../ui/adLanding.js';

export const AD_CONSENT_KEY = 'offside_ad_consent_v1';
const pixelId = String(import.meta.env.VITE_META_PIXEL_ID ?? '');

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[];
  push: Fbq;
  loaded: boolean;
  version: string;
};
type PixelWindow = Window & typeof globalThis & { fbq?: Fbq; _fbq?: Fbq };
const w = () => window as PixelWindow;
let loaded = false;

/** 픽셀 ID가 있는 운영 빌드에서만 켠다(호스트 검사는 GA4 설정과 같다). */
export const metaEnabled = () => /^\d{6,20}$/.test(pixelId) && analyticsEnabled();

export function getAdConsent(): 'granted' | 'denied' | 'unknown' {
  try {
    const v = localStorage.getItem(AD_CONSENT_KEY);
    return v === 'granted' || v === 'denied' ? v : 'unknown';
  } catch {
    return 'unknown';
  }
}
const allowed = () => metaEnabled() && getAdConsent() === 'granted';

export function setAdConsent(value: 'granted' | 'denied') {
  if (!metaEnabled()) return;
  try {
    localStorage.setItem(AD_CONSENT_KEY, value);
  } catch {
    /* 저장이 막히면 이번 탭에서도 불러오지 않는다. */
    return;
  }
  if (value === 'granted') loadPixel();
  else stopPixel();
}

function fbq(...args: unknown[]) {
  try {
    w().fbq?.(...args);
  } catch {
    /* 광고 차단기 */
  }
}

/** 광고 클릭으로 열린 탭이면 동의한 뒤에 클릭 ID를 픽셀 쿠키 형식(_fbc)으로 넘긴다. */
function keepClickId() {
  const click = landingClickId();
  if (!click || document.cookie.split(';').some((c) => c.trim().startsWith('_fbc='))) return;
  document.cookie = `_fbc=fb.1.${click.at}.${click.id}; Max-Age=${90 * 86400}; path=/; SameSite=Lax; Secure`;
}

export function loadPixel() {
  if (!allowed()) return;
  if (loaded) {
    // 이 탭에서 철회했다가 다시 동의한 경우.
    keepClickId();
    fbq('consent', 'grant');
    return;
  }
  loaded = true;
  keepClickId();
  // 메타가 안내하는 기본 큐: 스크립트가 오기 전 호출은 queue에 쌓였다가 처리된다.
  const q = function (...args: unknown[]) {
    if (q.callMethod) q.callMethod(...args);
    else q.queue.push(args);
  } as Fbq;
  q.push = q;
  q.loaded = true;
  q.version = '2.0';
  q.queue = [];
  w().fbq ??= q;
  w()._fbq ??= q;
  fbq('set', 'autoConfig', false, pixelId);
  fbq('init', pixelId);
  fbq('track', 'PageView');
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://connect.facebook.net/en_US/fbevents.js';
  script.dataset.offsideMeta = 'true';
  document.head.append(script);
}

function stopPixel() {
  if (loaded) fbq('consent', 'revoke');
  for (const name of ['_fbp', '_fbc']) {
    for (const domain of ['', `; domain=${location.hostname}`, `; domain=.${location.hostname}`]) {
      document.cookie = `${name}=; Max-Age=0; path=/${domain}; SameSite=Lax`;
    }
  }
}

/** 전환 이벤트. 값 없이 이름만 보낸다. */
export function trackMeta(event: 'CareerStart' | 'FirstSeason' | 'AppStoreClick') {
  if (!allowed() || !loaded) return;
  fbq('trackCustom', event);
}
