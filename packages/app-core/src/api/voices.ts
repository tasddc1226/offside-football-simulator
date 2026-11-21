// T-11-802 게임 안 '의견 보내기'. 타입은 type-only import라 번들에 zod가 들어가지 않는다(숫자는 @offside/contracts/voice).
import type { VoiceInput } from '@offside/contracts';
import { apiFetch, withProfile } from './client.js';

/**
 * 의견을 보낸다(성공하면 204). 익명 프로필로 충분하다 — 세션이 없는 첫 방문자는 익명 세션을 받은 뒤 한 번 더 보낸다.
 * 다른 화면의 조회 메모는 비우지 않는다(keepCache).
 */
export const sendVoice = (input: VoiceInput) =>
  withProfile(() =>
    apiFetch<undefined>('/v1/voices', {
      method: 'POST',
      body: JSON.stringify(input),
      keepCache: true,
    }),
  );
