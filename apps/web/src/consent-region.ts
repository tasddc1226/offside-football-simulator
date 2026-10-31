// T-11-597 이용 분석 · 광고 측정 · 유입 연결을 먼저 묻는 지역과 알린 뒤 기본으로 켜는 지역을 나눈다.
// 유럽경제지역 · 영국 · 스위스는 쓰기 전에 동의를 받아야 해서 지금처럼 동의 창을 띄우고, 나머지 나라는 개인정보처리방침으로
// 알리고 환경설정에서 끌 수 있게 한다. 나라는 웹 워커가 HTML을 내려 줄 때 Cloudflare가 붙인 접속 나라로 정해 쿠키로 넘긴다.
// 쿠키가 없거나(로컬 · 테스트 · 차단) 나라를 모르면 묻는 쪽으로 둔다.

export const CONSENT_REGION_COOKIE = 'offside_consent_region';

/** 먼저 동의를 받는 나라: EU 27개국 + 아이슬란드 · 리히텐슈타인 · 노르웨이 + 영국 + 스위스. */
const ASK_FIRST = new Set(
  (
    'AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE ' +
    'IS LI NO GB CH ' +
    // 프랑스 해외 지역 · 포르투갈 · 스페인 자치 지역처럼 EU 법이 그대로 적용되는 곳이 따로 잡히는 경우.
    'GF GP MQ RE YT MF AX'
  ).split(' '),
);

export type ConsentRegion = 'ask' | 'notice';

export function consentRegion(country: unknown): ConsentRegion {
  if (typeof country !== 'string' || !/^[A-Z]{2}$/.test(country) || country === 'XX') return 'ask';
  return ASK_FIRST.has(country) ? 'ask' : 'notice';
}

/** 웹 워커가 HTML 응답에 붙이는 쿠키. 화면 스크립트가 읽어야 해서 HttpOnly가 아니다. */
export const consentRegionCookie = (region: ConsentRegion) =>
  `${CONSENT_REGION_COOKIE}=${region}; Max-Age=86400; Path=/; SameSite=Lax; Secure`;

/** 바뀐 개인정보처리방침 시행일(2026-11-07 00:00 KST). 그 전에는 지금처럼 모든 지역에서 묻는다. */
export const CONSENT_DEFAULT_FROM = Date.parse('2026-11-06T15:00:00Z');

/** 화면에서: 알린 뒤 기본으로 켜는 지역인가. */
export function consentByDefault(now = Date.now()): boolean {
  if (typeof document === 'undefined' || now < CONSENT_DEFAULT_FROM) return false;
  try {
    return document.cookie.split(';').some((c) => c.trim() === `${CONSENT_REGION_COOKIE}=notice`);
  } catch {
    return false;
  }
}
