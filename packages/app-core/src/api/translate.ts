// T-11-146 사용자 글(댓글·채팅) "번역 보기". 타입은 type-only import라 번들에 zod가 들어가지 않는다.
import type { TranslateResponse } from '@offside/contracts';
import type { Locale } from '@offside/contracts/i18n';
import { apiFetch, withProfile } from './client.js';

/** 번역 결과는 서버가 D1에 담아 둔다. 쓰기가 아니라서 다른 메모를 비우지 않는다. */
export const translate = (text: string, to: Locale) =>
  withProfile(() =>
    apiFetch<TranslateResponse>('/v1/translate', {
      method: 'POST',
      body: JSON.stringify({ text, to }),
      keepCache: true,
    }),
  );
