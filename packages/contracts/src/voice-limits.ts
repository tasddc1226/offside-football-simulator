// T-11-802 게임 안 '의견 보내기'(voice). 웹 · 앱 화면과 서버가 같은 숫자를 쓰도록 zod 없이 둔다(@offside/contracts/voice).
// 이름이 voice인 것은 코치 피드백(app-core career-feedback.ts)과 겹치지 않게 하려는 것이다.

/** 의견 종류. 고르지 않으면 other로 보낸다. */
export const VOICE_KINDS = ['bug', 'idea', 'other'] as const;
export type VoiceKind = (typeof VOICE_KINDS)[number];

/** 의견 창을 연 곳(입구). */
export const VOICE_SCREENS = ['settings', 'home'] as const;
export type VoiceScreen = (typeof VOICE_SCREENS)[number];

/** 보낸 기기. 서버가 세션 채널로 정한다(앱 세션만 ios · android). */
export const VOICE_PLATFORMS = ['web', 'ios', 'android'] as const;
export type VoicePlatform = (typeof VOICE_PLATFORMS)[number];

/** 본문 길이(앞뒤 공백을 뺀 글자 수). 클라이언트 maxlength와 서버 검증이 같은 숫자를 쓴다. */
export const VOICE_BODY_MIN = 2;
export const VOICE_BODY_MAX = 500;
/** 맥락 칸 상한. 서버가 이 길이로 자른다. */
export const VOICE_DEVICE_MAX = 40;
export const VOICE_VERSION_MAX = 60;
/** 운영자가 한 번에 처리하는 의견 수. D1 바인딩 100개 한도 안에 둔다. */
export const VOICE_RESOLVE_MAX = 50;
/** 운영 목록 한 쪽 크기와 상한. */
export const VOICE_ADMIN_PAGE = 50;
export const VOICE_ADMIN_PAGE_MAX = 100;

/** 공백 · 제어(Cc) · 서식(Cf) · 한글 채움 문자 · 점자 빈칸이 아닌 글자(content-filter.ts PUBLIC_NAME_CHARS와 같은 집합). */
const VISIBLE = /[^\s\p{Cc}\p{Cf}\u115F\u1160\u3164\uFFA0\u2800]/u;
/** 보이는 글자가 하나는 있는지. 줄바꿈은 받지만 보이는 글자로 치지 않는다. */
export const hasVisibleChar = (s: string): boolean => VISIBLE.test(s);
