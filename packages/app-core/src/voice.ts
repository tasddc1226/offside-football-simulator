// T-11-802 게임 안 '의견 보내기' 시트(웹 VoiceSheet.svelte · 앱 screens/voice/VoiceSheet.tsx 공용). 시트를 열 때는 요청하지 않고,
// 보낼 때 POST /v1/voices 한 번만 나간다. 고른 종류와 쓴 글은 이 모듈에 남아 시트를 닫았다 열어도 그대로 보이고, 보내기에
// 성공하면 비운다. 맥락(입구 · 기기 대략값 · 버전)은 웹 · 앱이 각자 재료를 모아 여기 함수로 같은 꼴로 만든다. 선수 이름 ·
// 닉네임 · 구단 이름 · 커리어 id · 전체 UA는 보내지 않는다.
import {
  hasVisibleChar,
  VOICE_BODY_MAX,
  VOICE_BODY_MIN,
  VOICE_DEVICE_MAX,
  VOICE_KINDS,
  VOICE_VERSION_MAX,
  type VoiceKind,
  type VoiceScreen,
} from '@offside/contracts/voice';
import { sendVoice } from './api/voices.js';
import { voiceText as VT } from './i18n/ko/voice.js';

export { VOICE_BODY_MAX, VOICE_KINDS, type VoiceKind, type VoiceScreen };

/** 시트의 초안. 웹 · 앱이 함께 쓰는 모듈 변수다. */
export const voiceDraft: { kind: VoiceKind | null; text: string } = { kind: null, text: '' };

/** 종류를 고른다. 같은 칸을 다시 누르면 고름을 푼다(고르지 않으면 other로 보낸다). */
export function pickVoiceKind(kind: VoiceKind): VoiceKind | null {
  voiceDraft.kind = voiceDraft.kind === kind ? null : kind;
  return voiceDraft.kind;
}

/** 종류 칸 이름(지금 언어). */
export const voiceKindLabel = (kind: VoiceKind): string =>
  kind === 'bug' ? VT.kindBug : kind === 'idea' ? VT.kindIdea : VT.kindOther;

/** 고른 종류에 맞는 입력 칸 안내. */
export const voicePlaceholder = (kind: VoiceKind | null): string =>
  kind === 'bug' ? VT.placeholderBug : kind === 'idea' ? VT.placeholderIdea : VT.placeholder;

/** 보낼 본문으로 다듬는다(앞뒤 공백 제거). 보낼 수 없으면 시트 안에 띄울 안내. */
export function checkVoice(
  text: string,
): { ok: true; body: string } | { ok: false; message: string } {
  const body = text.trim();
  if (!body) return { ok: false, message: VT.empty };
  if (body.length < VOICE_BODY_MIN || !hasVisibleChar(body))
    return { ok: false, message: VT.short };
  return { ok: true, body };
}

/** 보낼 때 붙이는 맥락. platform은 서버가 세션 채널로 다시 정한다(웹 세션이 ios를 보내도 web). */
export type VoiceContext = {
  screen: VoiceScreen;
  platform: string;
  version: string;
  device: string | null;
};

/**
 * 초안을 보낸다. checkVoice를 통과해야 보내고, 성공하면 초안을 비운다. 실패하면 초안은 그대로 두고 시트 안에 띄울 문구를
 * 돌려준다 — 서버 오류는 서버가 언어별로 만든 문장, 연결 실패 · 읽지 못한 응답은 VT.fail.
 */
export async function submitVoice(
  ctx: VoiceContext,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const checked = checkVoice(voiceDraft.text);
  if (!checked.ok) return checked;
  const r = await sendVoice({
    kind: voiceDraft.kind ?? 'other',
    body: checked.body,
    screen: ctx.screen,
    platform: ctx.platform,
    version: voiceVersion(ctx.version),
    ...(ctx.device ? { device: ctx.device } : {}),
  });
  if (r.ok) {
    voiceDraft.kind = null;
    voiceDraft.text = '';
    return { ok: true };
  }
  const offline = r.error.code === 'NETWORK_ERROR' || r.error.code === 'INVALID_RESPONSE';
  return { ok: false, message: offline ? VT.fail : r.error.message };
}

/** 버전: 앞뒤 공백을 빼고 60자로. 비면 'unknown'(서버와 같은 규칙). */
export const voiceVersion = (v: string | null | undefined): string =>
  (v ?? '').trim().slice(0, VOICE_VERSION_MAX).trim() || 'unknown';

/**
 * 기기 대략값: 비어 있지 않은 조각을 공백으로 잇고 서버와 같은 규칙(소문자 · 숫자 · 공백 · . _ -, 40자)으로 다듬는다. 비면 null.
 * 앱은 voiceDevice(Platform.OS, Platform.Version) → 'ios 18.1' · 'android 34'.
 */
export function voiceDevice(
  ...parts: (string | number | false | null | undefined)[]
): string | null {
  const s = parts
    .filter((p) => p !== false && p !== null && p !== undefined && p !== '')
    .join(' ')
    .toLowerCase()
    .replace(/[^a-z0-9 ._-]/g, '')
    .replace(/ {2,}/g, ' ')
    .trim()
    .slice(0, VOICE_DEVICE_MAX)
    .trim();
  return s || null;
}

/** 웹 기기 대략값: OS(inapp.ts osOf) · 앱 안 브라우저 이름(detectInApp) · 홈 화면 앱이면 pwa. 예: 'ios instagram', 'other pwa'. */
export const webVoiceDevice = (
  os: string,
  inApp: string | null | undefined,
  standalone: boolean,
): string | null => voiceDevice(os, inApp, standalone && 'pwa');

/** 앱 버전: 오류 보고와 같은 꼴 '버전 (빌드) · OTA 앞 8자'(앱 updates.ts appBuildInfo). */
export const appVoiceVersion = (b: { version: string; build: string; updateId: string | null }) =>
  `${b.version} (${b.build})${b.updateId ? ` · ${b.updateId}` : ''}`;
