import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import { AppError } from '../errors.js';
import type { AppEnv } from '../env.js';
import { countable, flushTallies, recordRequest } from '../status/metrics.js';
import { flushClientErrors, takeClientErrors } from '../status/clientErrors.js';

/** T-2-015: 응답 본문에는 고정 문구만 나가므로(errors.ts) 원문 메시지는 여기서만 남긴다. */
const MAX_ERROR_MESSAGE_LENGTH = 500;
/** T-11-252 운영에서 정상 응답(info) 줄은 이 비율만 남긴다. 경고·오류는 전부 남긴다. Workers Logs는 월 2천만 건을
 * 넘기면 백만 건당 $0.60이고, 하루 요청 110만 건이면 호출 로그를 꺼도 전부 남기면 월 3천만 건이 넘는다. */
export const INFO_LOG_SAMPLE_RATE = 0.1;

/** 결정 7: 요청당 JSON 한 줄. 헤더·쿠키·토큰·본문·이메일·선수명은 절대 담지 않는다. */
export const logger = createMiddleware<AppEnv>(async (c, next) => {
  const startedAt = c.get('startedAt');
  await next();

  const status = c.res.status;
  const storeFailure = c.get('storeFailure');
  const entry: Record<string, unknown> = {
    level: status >= 500 ? 'error' : status >= 400 || storeFailure ? 'warn' : 'info',
    ts: new Date().toISOString(),
    requestId: c.get('requestId'),
    method: c.req.method,
    path: new URL(c.req.url).pathname,
    status,
    durationMs: Date.now() - startedAt,
  };
  recordStatus(c, status, entry.durationMs as number);

  const session = c.get('session');
  if (session) {
    entry.profileId = session.profileId;
  }

  if (c.error) {
    entry.errorCode = c.error instanceof AppError ? c.error.code : 'SERVICE_UNAVAILABLE';
    entry.errorMessage = c.error.message.slice(0, MAX_ERROR_MESSAGE_LENGTH);
    entry.error = { name: c.error.name, message: c.error.message, stack: c.error.stack };
  } else if (storeFailure) {
    entry.errorCode = storeFailure.code;
    entry.error = { message: storeFailure.message };
  }

  if (entry.level === 'info' && c.env?.ENVIRONMENT === 'production') {
    if (Math.random() >= INFO_LOG_SAMPLE_RATE) return;
    entry.sampleRate = INFO_LOG_SAMPLE_RATE;
  }
  console.log(JSON.stringify(entry));
});

/** T-11-321 서버 상태 화면용 집계. 원격 환경에서만 센다(로컬·테스트 DB에 쓰지 않는다). */
const STATUS_ENVS = new Set(['production', 'staging']);

function recordStatus(c: Context<AppEnv>, status: number, durationMs: number) {
  const db = c.env?.DB;
  if (!db || !STATUS_ENVS.has(c.env.ENVIRONMENT ?? '')) return;
  if (!countable(c.req.method, c.req.header('upgrade'))) return;
  let ctx: Pick<ExecutionContext, 'waitUntil'>;
  try {
    ctx = c.executionCtx;
  } catch {
    return; // executionCtx가 없는 실행(app.request 테스트)에서는 세지도 쓰지도 않는다.
  }
  const due = recordRequest(Date.now(), durationMs, status);
  if (!due) return;
  const warn = (msg: string) => (error: unknown) =>
    console.log(JSON.stringify({ level: 'warn', msg, error: String(error).slice(0, 200) }));
  ctx.waitUntil(flushTallies(db, due).catch(warn('status-flush-failed')));
  // T-11-331 앱·웹 오류도 같은 1분 주기에 더한다.
  const errors = takeClientErrors();
  if (errors.length)
    ctx.waitUntil(flushClientErrors(db, errors).catch(warn('client-errors-flush-failed')));
}
