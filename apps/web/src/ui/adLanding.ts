// T-11-195 메타 광고(페이스북·인스타그램)로 처음 들어온 방문인지 기억한다. 광고는 대개 앱 안 브라우저에서 열리므로,
// 이런 방문에는 첫 시즌을 마치기 전까지 '외부 브라우저로 열기' 안내를 미루고(먼저 플레이하게), 아직 비공개 테스트인
// 안드로이드 테스터 모집 안내도 숨긴다. 남기는 값은 '광고로 왔다'는 표시뿐이다. 클릭 ID(fbclid)는 저장하지 않고
// 이번 탭의 메모리에만 두며, 광고 측정에 동의한 경우에만 메타 픽셀 쿠키로 넘긴다(analytics/meta.ts).
import { hasKey, loadKey, saveKey } from '@offside/game/storage';
import { appState } from './state.svelte.js';

const KEY = 'ft_ad_landing';
const AD_SOURCES = ['meta', 'facebook', 'instagram'];

let clickId: { id: string; at: number } | null = null;

/** 부팅 때 한 번. 광고 주소(fbclid 또는 utm_source=meta 등 + utm_medium=paid)면 표시를 남긴다. */
export function detectAdLanding(href = location.href) {
  try {
    const q = new URL(href).searchParams;
    const fbclid = q.get('fbclid');
    const paid = q.get('utm_medium') === 'paid' && AD_SOURCES.includes(q.get('utm_source') ?? '');
    if (fbclid && /^[\w-]{1,500}$/.test(fbclid)) clickId = { id: fbclid, at: Date.now() };
    if ((fbclid || paid) && !loadKey<boolean>(KEY)) saveKey(KEY, true);
  } catch {
    /* 주소를 못 읽으면 광고 방문으로 치지 않는다. */
  }
}

/** 이 브라우저가 광고로 처음 들어왔는가. */
export const adLanded = () => loadKey<boolean>(KEY) === true;

/** 이번 탭이 광고 클릭으로 열렸으면 그 클릭 ID(메모리에만 있다). */
export const landingClickId = () => clickId;

/** 첫 시즌을 마쳤거나 은퇴 기록이 있는가 — 광고 방문에 미뤄 둔 안내를 이제 보여도 되는가. */
export const playedEnough = () => (appState.G?.career.length ?? 0) >= 1 || hasKey('ft_hof');
