// T-11-770d 첫 구매 묶음(기획 T-11-747 R2). 실결제 이력이 없는 구단주가 한 번만 사는 소모성 묶음으로, 세 가지 아이템을 한 번에
// 준다. 서버(자격 · 지급)와 화면(안내)이 같은 값을 쓰게 한 곳에 둔다. zod 없는 서브패스(`@offside/contracts/starter-pack`).
import type { AttendanceReward } from './attendance-rules.js';

/** App Store Connect · Play Console에 같은 ID로 만드는 소모성 상품. 구성을 바꾸면 새 ID · 새 판(version)을 만든다. */
export const STARTER_PACK_PRODUCT_ID = 'com.offsidelab.app.starter_v1';
/** 구성의 판. 거래 원장에 같이 적어, 나중에 구성이 바뀌어도 그 거래가 받은 것을 안다. */
export const STARTER_PACK_VERSION = 'v1';
/**
 * 판마다의 구성. 시즌 패스 1단계(스카우트 2 · 강화 10 · 리롤 10, 9,900원)보다 원당 스카우트권이 많지 않게 스카우트는 1장으로
 * 둔다. 카드 강화 시도 · 보호 · 구단 자금은 넣지 않는다.
 */
export const STARTER_PACK_ITEMS: Record<string, AttendanceReward> = {
  v1: { scout: 1, boost: 5, reroll: 5 },
};
export const starterPackItems = (version: string = STARTER_PACK_VERSION): AttendanceReward =>
  STARTER_PACK_ITEMS[version] ?? {};
/** 한국 기준가(원). 실제 결제 금액은 스토어가 나라에 맞춰 보인다. */
export const STARTER_PACK_PRICE_KRW = 3300;
/**
 * 화면에 입구를 보이는지. 스토어 상품 승인 · 서버 STARTER_PACK_ENABLED · 실기기 결제 확인이 끝나면 true로 바꿔 연다(false면
 * 개발 빌드에서만 보인다). 판매 자체는 서버가 정한다.
 */
export const STARTER_PACK_LIVE = false;
/** 대조군 비율(%). 자격이 되는 구단주 가운데 이만큼은 묶음을 보지 않는다(프로필마다 고정, 전체 결제 기여액 비교용). */
export const STARTER_PACK_CONTROL_PCT = 20;
/** 이 나이 이상에 은퇴한 선수가 한 명은 있어야 보인다(끝까지 뛴 커리어). */
export const STARTER_PACK_RETIRE_AGE = 35;
