// T-11-802 게임 안 의견을 저장하기 전에 다듬고 가린다. 본문은 운영자만 읽지만, 유저가 실수로 적은 메일 · 전화번호 · 복구 코드와
// 다른 사이트 주소에 붙은 토큰(결제 · 로그인)이 서버에 남지 않게 한다. 완벽한 탐지가 목적은 아니고, 욕설은 거르지 않는다.
// 오류 지문의 scrub(status/clientErrors.ts)과 일부러 나눈다. 그쪽을 고치면 오류 지문이 바뀐다.
import {
  VOICE_BODY_MAX,
  VOICE_DEVICE_MAX,
  VOICE_KINDS,
  VOICE_VERSION_MAX,
  type VoiceKind,
  type VoicePlatform,
} from '@offside/contracts/voice';
import { sha256Hex } from '../db/hash.js';
import type { SessionChannel } from '../db/repos/sessions.js';

/** 주소(스킴이 있거나 www.로 시작). 끝의 문장 부호도 함께 잡힐 수 있다. */
const URL_SPLIT = /(\b(?:https?:\/\/|www\.)[^\s<>"'`]+)/i;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
/** 복구 코드 OFS-XXXX-XXXX-XXXX. 대시 · 공백이 있어도 없어도, 대소문자도 가리지 않는다. */
const OFS_CODE =
  /(?<![A-Za-z0-9])ofs[\s-]?[a-z0-9]{4}[\s-]?[a-z0-9]{4}[\s-]?[a-z0-9]{4}(?![a-z0-9])/gi;
/** 접두 없는 4-4-4 대시 꼴. 글자가 섞였을 때만 코드로 본다(숫자만 있는 날짜 · 기록 표기는 둔다). UUID 조각은 앞뒤 대시로 거른다. */
const DASH_CODE = /(?<![A-Za-z0-9-])[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}(?![A-Za-z0-9-])/g;
/** 전화번호 후보: '+국가번호'나 0으로 시작하는 숫자 묶음을 - . 공백 하나로 잇는다. 맞는지는 isPhone이 본다. */
const PHONE_CANDIDATE = /(?<![\w+.-])(?:\+\d+|0\d+)(?:[-. ]\d+)*/g;

/**
 * 구분자를 빼면 9~13자리. 0으로 시작하면 첫 묶음 2자리 이상 · 다음 묶음 3자리 이상(02-123-4567, 0912-345-678),
 * '+'로 시작하면 다음 묶음 2자리 이상(+82 10 1234 5678). 0.5 0.3 같은 소수 나열 · 0-3 같은 점수 · 03:00은 걸리지 않는다.
 */
function isPhone(groups: string[], intl: boolean): boolean {
  const digits = groups.join('').length;
  if (digits < 9 || digits > 13) return false;
  if (!intl && groups[0]!.length < 2) return false;
  return groups.slice(1).every((g) => g.length >= (intl ? 2 : 3));
}

/** 후보 앞쪽에서 전화번호로 보이는 가장 긴 묶음을 가린다(뒤에 붙은 숫자 묶음은 남긴다). */
function maskPhone(candidate: string): string {
  const parts = candidate.split(/([-. ])/);
  const intl = candidate.startsWith('+');
  for (let k = parts.length; k >= 1; k -= 2) {
    const groups = parts.slice(0, k).filter((_, i) => i % 2 === 0);
    if (isPhone(intl ? [groups[0]!.slice(1), ...groups.slice(1)] : groups, intl))
      return `[phone]${parts.slice(k).join('')}`;
  }
  return candidate;
}

/** 주소 밖 글에서 메일 → 복구 코드 → 전화번호 순으로 가린다. 6자리 이상 숫자(게임 수치)는 0으로 시작하지 않으면 그대로다. */
function maskText(text: string): string {
  return text
    .replace(EMAIL, '[email]')
    .replace(OFS_CODE, '[code]')
    .replace(DASH_CODE, (m) => (/[A-Za-z]/.test(m) ? '[code]' : m))
    .replace(PHONE_CANDIDATE, maskPhone);
}

function hostOf(url: string): string {
  const authority = url.replace(/^https?:\/\//i, '').split(/[/?#\\]/, 1)[0] ?? '';
  return authority
    .slice(authority.lastIndexOf('@') + 1)
    .replace(/:\d*$/, '')
    .toLowerCase();
}

/**
 * offside-lab.com과 하위 도메인 주소는 그대로 둔다(소식 글 ?news= 링크). 다만 API 주소(api.offside-lab.com)는 구글 로그인 콜백의
 * code · state가 쿼리에 실리므로 쿼리와 조각을 지운다. 다른 사이트 주소는 쿼리와 조각을 지우고 나머지를 가린다.
 */
function cleanUrl(url: string): string {
  const host = hostOf(url);
  const ours = host === 'offside-lab.com' || host.endsWith('.offside-lab.com');
  if (ours && host !== 'api.offside-lab.com') return url;
  const bare = url.split(/[?#]/, 1)[0] ?? '';
  return ours ? bare : maskText(bare);
}

/**
 * 줄바꿈을 LF로, 줄바꿈 · 탭 말고 제어 문자는 지우고, 빈 줄이 셋 이상 이어지면 둘로 줄이고('a\n\n\n\nb' → 'a\n\n\nb'),
 * 앞뒤 공백을 지운다.
 */
export function tidyVoiceBody(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/[^\P{Cc}\n\t]/gu, '')
    .replace(/\n(?:[^\S\n]*\n){3,}/g, '\n\n\n')
    .trim();
}

/** 다듬고 가린 본문. 가린 뒤 500자를 넘으면 자른다. */
export function cleanVoiceBody(raw: string): string {
  const masked = tidyVoiceBody(raw)
    .split(URL_SPLIT)
    .map((part, i) => (i % 2 === 1 ? cleanUrl(part) : maskText(part)))
    .join('');
  let out = masked.slice(0, VOICE_BODY_MAX);
  // 자른 자리에 남은 서로게이트 반쪽(이모지 앞쪽)은 뺀다.
  if (/[\uD800-\uDBFF]$/.test(out)) out = out.slice(0, -1);
  return out.trimEnd();
}

/** 같은 글 지문: 소문자 · 공백 하나로 맞춘 본문의 SHA-256 앞 16자. 공백 · 대소문자만 다른 글은 같은 값이다. */
export async function voiceBodyKey(body: string): Promise<string> {
  return (await sha256Hex(body.toLowerCase().replace(/\s+/g, ' ').trim())).slice(0, 16);
}

export type VoiceContextInput = {
  kind?: string | undefined;
  screen?: string | undefined;
  platform?: string | undefined;
  version?: string | undefined;
  device?: string | undefined;
};
export type VoiceContext = {
  kind: VoiceKind;
  screen: string | null;
  platform: VoicePlatform;
  appVersion: string;
  device: string | null;
};

const SCREEN = /^[a-z][a-z0-9:_-]{0,39}$/;

/**
 * 맥락 칸은 클라이언트 값을 믿지 않고 서버가 정한다. 종류는 모르면 other, 입구는 패턴 밖이면 null, 기기 종류(platform)는 앱 세션이
 * ios · android를 보냈을 때만 그 값이고 나머지(웹 · 토스)는 web, 버전은 앞 60자(비면 unknown), 기기 대략값은 소문자 · 숫자 · 공백 ·
 * . _ - 만 남긴 40자(비면 null).
 */
export function cleanVoiceContext(input: VoiceContextInput, channel: SessionChannel): VoiceContext {
  const kind = VOICE_KINDS.find((k) => k === input.kind) ?? 'other';
  const screen = input.screen && SCREEN.test(input.screen) ? input.screen : null;
  const platform: VoicePlatform =
    channel === 'app' && (input.platform === 'ios' || input.platform === 'android')
      ? input.platform
      : 'web';
  const appVersion =
    (input.version ?? '')
      .replace(/[\p{Cc}\p{Cf}]/gu, '')
      .trim()
      .slice(0, VOICE_VERSION_MAX)
      .trim() || 'unknown';
  const device =
    (input.device ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9 ._-]/g, '')
      .replace(/ {2,}/g, ' ')
      .trim()
      .slice(0, VOICE_DEVICE_MAX)
      .trim() || null;
  return { kind, screen, platform, appVersion, device };
}
