import {
  AdminVoiceListSchema,
  AdminVoiceQuerySchema,
  AdminVoiceResolveResultSchema,
  AdminVoiceResolveSchema,
  VoiceInputSchema,
} from '@offside/contracts';
import type { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import { requireAdmin } from '../auth/admin.js';
import { insertVoice, listVoices, resolveVoices } from '../db/repos/voices.js';
import { getDb, type AppEnv } from '../env.js';
import { AppError, parseWithAppError } from '../errors.js';
import { queryWithoutLang, reqLang } from '../lang.js';
import { getSessionOrThrow, requireProfile } from '../middleware/requireProfile.js';
import { cleanVoiceBody, cleanVoiceContext, voiceBodyKey } from '../voice/clean.js';
import { clientIp, enforceLimit, NO_STORE, nowIso, ok, readBody } from './shared.js';

// T-11-802 게임 안 '의견 보내기'. 유저는 보내기만 하고(답장 없음, 사용자 쪽 GET 없음), 운영자는 운영 도구 '유저 의견' 탭에서 읽고
// 처리 표시를 한다. 본문은 로그 · 응답에 싣지 않고, 아침 알림(slack-ops.mjs)에는 건수만 보낸다(본문 · 프로필 id 없음).
// 멱등 키 표(idempotency)는 쓰지 않는다 — 같은 글은 (profile_id, body_key) 고유 키가 한 번만 남기고, 응답 사본을 하루 동안
// 남길 일도 없다.

/** 프로필당 · IP당 시간당 보내기 횟수(운영 DB auth_attempts). */
const VOICE_LIMIT = 5;
const VOICE_IP_LIMIT = 20;
// i18n-ignore: 응답 때 errorText가 옮긴다
const TOO_OFTEN = '의견을 너무 자주 보내고 있어요. 잠시 뒤에 다시 시도해 주세요.';
// i18n-ignore: 응답 때 errorText가 옮긴다
const PAUSED = '잠시 후 다시 시도해 주세요.';

/** 비상 스위치(VOICE_DISABLED='1'). 세션 · DB를 읽기 전에 막는다. */
const voicesOpen = createMiddleware<AppEnv>(async (c, next) => {
  if (c.env.VOICE_DISABLED === '1')
    throw new AppError({ code: 'SERVICE_UNAVAILABLE', message: PAUSED });
  await next();
});

export function registerVoiceRoutes(app: Hono<AppEnv>): void {
  // D1 왕복: 게임 DB 2번(세션 · INSERT), 운영 DB 2번(VOICE · VOICE_IP 한도). 프로필 한도에서 막히면 IP 횟수는 세지 않는다.
  app.post('/v1/voices', voicesOpen, requireProfile, async (c) => {
    const input = readBody(c, VoiceInputSchema);
    const session = getSessionOrThrow(c);
    const db = getDb(c);
    const now = nowIso();
    await enforceLimit(db, 'VOICE', session.profileId, VOICE_LIMIT, now, TOO_OFTEN);
    await enforceLimit(db, 'VOICE_IP', clientIp(c), VOICE_IP_LIMIT, now, TOO_OFTEN);
    const body = cleanVoiceBody(input.body);
    await insertVoice(db, {
      profileId: session.profileId,
      ...cleanVoiceContext(input, session.channel),
      body,
      bodyKey: await voiceBodyKey(body),
      lang: reqLang(c),
      createdAt: now,
    });
    return c.body(null, 204);
  });

  // 운영 목록. 탭을 열 때 · 필터 · 더 보기 · 새로고침 때만 부른다(목록과 열린 건수를 batch 한 번으로).
  app.get('/v1/admin/voices', async (c) => {
    await requireAdmin(c);
    const q = parseWithAppError(AdminVoiceQuerySchema, queryWithoutLang(c));
    return ok(c, AdminVoiceListSchema, await listVoices(getDb(c), q), 200, NO_STORE);
  });

  // 처리 · 다시 열기. 대상이 없어도 404 없이 updated 0을 돌려준다.
  app.post('/v1/admin/voices/resolve', async (c) => {
    await requireAdmin(c);
    const { ids, resolved } = readBody(c, AdminVoiceResolveSchema);
    const updated = await resolveVoices(getDb(c), ids, resolved, nowIso());
    return ok(c, AdminVoiceResolveResultSchema, { updated }, 200, NO_STORE);
  });
}
