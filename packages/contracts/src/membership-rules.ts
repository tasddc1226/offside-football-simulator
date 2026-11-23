// T-11-512 클럽 멤버십. 한 달마다 자동으로 다시 결제되는 구독(4,900원)으로, 구독하는 동안 출석 보상 2배 · 매일 잠재력 강화권
// 1장(T-11-517) · 광고 제거 · 서포터 뱃지를 준다. 서버(혜택 판단)와 화면(안내)이 같은 값을 쓰게 한 곳에 둔다. zod 없는 서브패스(`@offside/contracts/membership`).

/** 앱 스토어(구독 그룹) · Play(구독 + 기본 요금제)에 같은 ID로 만드는 자동 갱신 구독. */
export const MEMBERSHIP_PRODUCT_ID = 'com.offsidelab.app.club_monthly';
/**
 * 화면에 멤버십 입구를 보이는지. T-11-516에서 켰다(false면 개발 빌드에서만 보인다). 판매
 * 자체는 서버 MEMBERSHIP_ENABLED가 정한다.
 */
export const MEMBERSHIP_LIVE = true;
/**
 * iOS 앱에서도 입구를 보이는지(T-11-516). App Store 구독(club_monthly) 심사가 끝나기 전에는 가입 버튼이 없으므로 iOS만 닫아 두고,
 * 승인되면 true로 바꿔 OTA로 연다. 웹 · Android는 MEMBERSHIP_LIVE만 본다.
 */
export const MEMBERSHIP_IOS_LIVE = true;
/**
 * T-11-770e 신규 구독자 첫 달 할인(기획 T-11-747 R3B)을 화면에 보이는지. T-11-772에서 켰다(한국 기준 첫 달 2,900원). 스토어 콘솔에 할인을 만들고 서버
 * MEMBERSHIP_INTRO_ENABLED를 켠 뒤에 true로 바꾼다. false면 스토어에 할인 요금제가 있어도 Android는 정상가 요금제로만 판다.
 * (iOS는 스토어가 자격 있는 계정에 할인을 자동으로 적용하므로, App Store Connect의 할인은 이 값을 켜는 배포와 같이 연다.)
 */
export const MEMBERSHIP_INTRO_LIVE = true;
/** Play 콘솔에서 월 기본 요금제에 만드는 신규 구독자 할인의 ID. 이 ID가 아닌 할인은 앱이 쓰지 않는다. */
export const MEMBERSHIP_INTRO_OFFER_ID = 'intro-1m';
/** 할인을 보이지 않는 대조군 비율(%). 프로필로 고정 배정한다(서버 membershipIntroGroup). */
export const MEMBERSHIP_INTRO_CONTROL_PCT = 20;
/** 한국 기준가(원/월). 실제 결제 금액은 스토어가 나라에 맞춰 보인다. */
export const MEMBERSHIP_PRICE_KRW = 4900;
/** 신규 구독자 첫 달 할인(T-11-772) · 이전 구독자 윈백 첫 달의 한국 기준가(원). 매출 집계의 어림에 쓴다. */
export const MEMBERSHIP_INTRO_PRICE_KRW = 2900;
export const MEMBERSHIP_WINBACK_PRICE_KRW = 2200;
/** 스토어 알림(`billing_alerts.offer`)에 적는 첫 결제의 할인 종류. 없으면 정상가다. */
export const MEMBERSHIP_OFFERS = ['intro', 'winback'] as const;
export type MembershipOffer = (typeof MEMBERSHIP_OFFERS)[number];
/** 멤버십 결제 한 건의 한국 기준 금액(원)을 내는 SQL 식. `billing_alerts`의 offer 칸을 읽는다. */
export const MEMBERSHIP_ALERT_PRICE_SQL = `CASE offer WHEN 'intro' THEN ${MEMBERSHIP_INTRO_PRICE_KRW} WHEN 'winback' THEN ${MEMBERSHIP_WINBACK_PRICE_KRW} ELSE ${MEMBERSHIP_PRICE_KRW} END`;
/** 구독 중 출석 보상 배수. */
export const MEMBER_ATTENDANCE_MULT = 2;
/** T-11-517 구독 중 출석할 때 배수와 따로 더 받는 아이템(매일 잠재력 강화권 1장). */
export const MEMBER_DAILY_BONUS = { boost: 1 } as const;

/** 스토어가 알려 준 만료 시각 기준으로 지금 혜택이 있나(결제 유예 중이면 유예 끝까지). */
export const memberActive = (until: string | null | undefined, now: string) =>
  !!until && until > now;

// ───────── T-11-818 연속 구독 · 서포터 뱃지 단계 · 개월 선물 ─────────
// 연속 구독(api member_tenure)은 끊기지 않은 구독이 시작된 시각(since)과 모든 구독 중 가장 늦은 혜택 끝(until)이다.

/** 혜택이 끝난 뒤 이 날수 안에 다시 이어지면 연속으로 본다(결제 재시도 · 늦게 다시 산 웹 이용권). */
export const TENURE_GAP_DAYS = 7;
const DAY_MS = 86_400_000;
/**
 * 지금까지 결제한 연속 개월 수(구독 중이 아니면 0). 한 달 = 30일로 세고 5일을 더해 28~31일 달 · 웹 30일권 · 첫 구독 때 묶인 시각이
 * 결제보다 조금 늦은 차이를 덮는다(결제 유예 16일까지는 다음 달로 세지 않는다).
 */
export function tenureMonths(since: string, until: string, now: string): number {
  if (!(until > now)) return 0;
  const days = (Date.parse(until) - Date.parse(since)) / DAY_MS;
  return Math.max(1, Math.floor((days + 5) / 30));
}

/** 서포터 뱃지 단계: 3개월 미만 1, 그다음 3 · 6 · 9개월. 구독 중이 아니면 null. */
export type SupporterTier = 1 | 3 | 6 | 9;
export const SUPPORTER_TIERS: readonly SupporterTier[] = [9, 6, 3];
export function supporterTier(months: number): SupporterTier | null {
  if (months <= 0) return null;
  return SUPPORTER_TIERS.find((t) => months >= t) ?? 1;
}

/** 개월 선물이 시작되는 연속 개월(가입한 첫 달은 멤버십 혜택만). */
export const TENURE_GIFT_FROM = 2;
/** 개월 선물의 잠재력 강화권 상한(달마다 1장씩 늘어 이 장수에서 멈춘다). */
export const TENURE_GIFT_BOOST_MAX = 6;
/**
 * 연속 n개월째 선물: 잠재력 강화권 n장(최대 TENURE_GIFT_BOOST_MAX장), 뱃지 단계가 오르는 3의 배수 달엔 프리미엄 스카우트권 1장을
 * 더한다. 2개월 미만이면 null.
 */
export function tenureGiftAt(months: number): { boost: number; scout: number } | null {
  if (months < TENURE_GIFT_FROM) return null;
  return { boost: Math.min(months, TENURE_GIFT_BOOST_MAX), scout: months % 3 === 0 ? 1 : 0 };
}
/** 선물 받은 기록(gift_claims) id. 연속 구독이 새로 시작되면 since 날짜가 바뀌어 다시 2개월째부터 받는다. */
export const tenureGiftPrefix = (since: string) => `mm:${since.slice(0, 10)}:`;
export const tenureGiftId = (since: string, months: number) =>
  `${tenureGiftPrefix(since)}${months}`;
