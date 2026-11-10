/**
 * T-11-684. 대회 · 수상 이름 바꾸기와 리그 · 대회 로고의 한도. zod가 없는 서브패스
 * (`@offside/contracts/comp-custom-limits`)라 웹 · 앱 저장(app-core)과 서버 계약(comp-custom.ts)이 같은 숫자를 쓴다.
 */
/** 바꾼 이름 하나의 최대 글자 수. */
export const CUSTOM_NAME_MAX = 30;
/** 원래 이름(키)의 최대 글자 수 — 게임 이름보다 넉넉하게. 로고의 키도 같다. */
export const COMP_CUSTOM_KEY_MAX = 60;
/** 이름표에 남기는 최대 수. */
export const CUSTOM_NAMES_LIMIT = 500;
/** 로고 이미지 하나(data URL)의 최대 글자 수. 96px WebP면 대개 3~10KB다. */
export const COMP_ICON_IMG_MAX = 16_000;
/** 로고 이미지 전체 합계 — 세이브와 같은 기기 저장소를 쓰므로 넉넉히 잡지 않는다. */
export const COMP_ICONS_TOTAL_MAX = 900_000;
/** 바꿀 수 있는 로고 수(리그 17 + 대회 47보다 넉넉하게). */
export const COMP_ICONS_LIMIT = 120;
/** 로고 이미지 형식. */
export const COMP_ICON_IMG_PATTERN = /^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/;
