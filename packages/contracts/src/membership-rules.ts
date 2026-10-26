// T-11-512 클럽 멤버십. 한 달마다 자동으로 다시 결제되는 구독(4,900원)으로, 구독하는 동안 출석 보상 2배 · 광고 제거 · 서포터
// 뱃지를 준다. 서버(혜택 판단)와 화면(안내)이 같은 값을 쓰게 한 곳에 둔다. zod 없는 서브패스(`@offside/contracts/membership`).

/** 앱 스토어(구독 그룹) · Play(구독 + 기본 요금제)에 같은 ID로 만드는 자동 갱신 구독. */
export const MEMBERSHIP_PRODUCT_ID = 'com.offsidelab.app.club_monthly';
/**
 * 화면에 멤버십 입구를 보이는지. T-11-516에서 켰다(false면 개발 빌드에서만 보인다). 판매
 * 자체는 서버 MEMBERSHIP_ENABLED가 정한다.
 */
export const MEMBERSHIP_LIVE = true;
/** 한국 기준가(원/월). 실제 결제 금액은 스토어가 나라에 맞춰 보인다. */
export const MEMBERSHIP_PRICE_KRW = 4900;
/** 구독 중 출석 보상 배수. */
export const MEMBER_ATTENDANCE_MULT = 2;

/** 스토어가 알려 준 만료 시각 기준으로 지금 혜택이 있나(결제 유예 중이면 유예 끝까지). */
export const memberActive = (until: string | null | undefined, now: string) =>
  !!until && until > now;
