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
/** 구독 중 출석 보상 배수. */
export const MEMBER_ATTENDANCE_MULT = 2;
/** T-11-517 구독 중 출석할 때 배수와 따로 더 받는 아이템(매일 잠재력 강화권 1장). */
export const MEMBER_DAILY_BONUS = { boost: 1 } as const;

/** 스토어가 알려 준 만료 시각 기준으로 지금 혜택이 있나(결제 유예 중이면 유예 끝까지). */
export const memberActive = (until: string | null | undefined, now: string) =>
  !!until && until > now;
