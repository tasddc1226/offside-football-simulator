import {
  AnalyticsEventsBodySchema,
  ANALYTICS_EVENT_PROPS_SCHEMAS,
  type AnalyticsEventName,
} from '@offside/contracts';
import type { Hono } from 'hono';
import { getAttemptCount, recordAttempt, ANALYTICS_RATE_LIMIT_MAX, ANALYTICS_RATE_LIMIT_WINDOW_MS } from '../db/repos/authAttempts.js';
import { insertAnalyticsEvents } from '../db/repos/analyticsEvents.js';
import { getDb, type AppEnv } from '../env.js';
import { AppError, parseWithAppError } from '../errors.js';

/** T-2-012 D-55: bodyGuard의 전역 1MB 상한과 별개로, 이 라우트만 32KB로 더 좁힌다. */
const ANALYTICS_BODY_MAX_BYTES = 32 * 1024;

function isWhitelistedEvent(name: string): name is AnalyticsEventName {
  return Object.hasOwn(ANALYTICS_EVENT_PROPS_SCHEMAS, name);
}

/** API-ANA-001: `POST /v1/analytics/events`. 화이트리스트 밖 이름·props 타입 불일치 이벤트는 건별로
 * 버리고 나머지만 저장한다 — 요청 전체는 항상 202(유실 허용, 01 "최종 일관성 허용"). */
export function registerAnalyticsRoutes(app: Hono<AppEnv>): void {
  app.post('/v1/analytics/events', async (c) => {
    const rawBody = c.get('rawBody') ?? '';
    if (new TextEncoder().encode(rawBody).length > ANALYTICS_BODY_MAX_BYTES) {
      throw new AppError({
        code: 'VALIDATION_FAILED',
        message: '분석 이벤트 본문이 너무 큽니다.',
        details: { reason: 'ANALYTICS_BODY_TOO_LARGE' },
      });
    }

    let json: unknown;
    try {
      json = rawBody.length > 0 ? JSON.parse(rawBody) : {};
    } catch {
      throw new AppError({ code: 'VALIDATION_FAILED', message: '요청 본문이 올바른 JSON이 아닙니다.' });
    }

    // .max(50)이 이벤트 50건 초과 요청 전체를 400으로 거부한다(브리프: "50건 초과" 두 선택지 중
    // 절단 대신 이 고정 규칙을 택함 — PR 본문 기록).
    const body = parseWithAppError(AnalyticsEventsBodySchema, json);

    const db = getDb(c);
    const now = new Date().toISOString();

    const attempts = await getAttemptCount(db, 'ANALYTICS_EVENTS', body.clientId, now, ANALYTICS_RATE_LIMIT_WINDOW_MS);
    if (attempts >= ANALYTICS_RATE_LIMIT_MAX) {
      throw new AppError({ code: 'RATE_LIMITED', message: '분석 이벤트 전송 횟수를 초과했습니다.' });
    }
    await recordAttempt(db, 'ANALYTICS_EVENTS', body.clientId, now, ANALYTICS_RATE_LIMIT_WINDOW_MS);

    const session = c.get('session');
    const accepted = body.events.filter((event) => {
      if (!isWhitelistedEvent(event.name)) return false;
      return ANALYTICS_EVENT_PROPS_SCHEMAS[event.name].safeParse(event.props ?? {}).success;
    });

    await insertAnalyticsEvents(
      db,
      accepted.map((event) => ({
        clientId: body.clientId,
        profileId: session?.profileId ?? null,
        name: event.name,
        props: event.props ?? {},
        clientTs: event.clientTs,
        receivedAt: now,
      })),
    );

    return c.body(null, 202);
  });
}
