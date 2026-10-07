import { TranslateInputSchema, TranslateResponseSchema } from '@offside/contracts';
import type { Hono } from 'hono';
import { getDb, type AppEnv } from '../env.js';
import { getSessionOrThrow, requireProfile } from '../middleware/requireProfile.js';
import { getTranslation, putTranslation, translationKey } from '../db/repos/translations.js';
import { translateText } from '../translate/ai.js';
import { enforceLimit, nowIso, ok, readBody } from './shared.js';
import { waitUntil } from '../edgeCache.js';

// T-11-146 사용자가 쓴 글(댓글·채팅)의 "번역 보기". 사용자가 버튼을 누를 때만 부른다. 같은 글·같은 언어는 D1 캐시에서
// 돌려주고(Workers AI를 다시 부르지 않는다), 캐시에 없을 때만 프로필당 시간당 TRANSLATE_LIMIT번까지 새로 번역한다.
const TRANSLATE_LIMIT = 60;

export function registerTranslateRoutes(app: Hono<AppEnv>): void {
  app.post('/v1/translate', requireProfile, async (c) => {
    const { text, to } = readBody(c, TranslateInputSchema);
    const key = await translationKey(text, to);
    const cached = await getTranslation(c.env.DB, key);
    if (cached !== undefined) return ok(c, TranslateResponseSchema, { text: cached });
    const now = nowIso();
    await enforceLimit(
      getDb(c),
      'TRANSLATE',
      getSessionOrThrow(c).profileId,
      TRANSLATE_LIMIT,
      now,
      // i18n-ignore: 응답 때 errorText가 옮긴다
      '번역을 너무 자주 요청했어요. 잠시 후 다시 시도해 주세요.',
    );
    const translated = await translateText(c.env.AI, text, to);
    // 캐시 쓰기는 응답 뒤로 미룬다(실패해도 다음에 다시 번역할 뿐이다).
    waitUntil(c, putTranslation(c.env.DB, key, translated, now));
    return ok(c, TranslateResponseSchema, { text: translated });
  });
}
