import { successEnvelope, TeamSeasonQuerySchema } from '@offside/contracts';
import { openTeamSeasons, teamSeasonAt } from '@offside/contracts/service-seasons';
import type { Context } from 'hono';
import type { AppEnv } from '../env.js';
import { AppError, parseWithAppError, type SchemaLike } from '../errors.js';

export const nowIso = () => new Date().toISOString();

/** 속도 제한의 주체 — Cloudflare가 넣는 접속 IP. */
export const clientIp = (c: Context<AppEnv>) => c.req.header('CF-Connecting-IP') ?? 'unknown';

/** 사람마다 다른 응답(엣지·브라우저 캐시 금지). */
export const NO_STORE = 'private, no-store';

/** 404 — 없는 대상. reason은 클라이언트가 구분할 때 쓰는 코드. */
export const notFoundError = (message: string, reason: string) =>
  new AppError({ code: 'VALIDATION_FAILED', status: 404, message, details: { reason } });

export const teamNotFound = () => notFoundError('팀을 찾을 수 없어요.', 'TEAM_NOT_FOUND');

/** T-10-092 `?season=` 팀 시즌 — 없으면 지금 시즌(휴식기면 마지막으로 열린 시즌). 열리지 않은 시즌이면 400. */
export function teamSeasonParam(raw: unknown, now: string): number {
  const q = parseWithAppError(TeamSeasonQuerySchema, raw);
  const open = openTeamSeasons(now);
  const season = q ?? teamSeasonAt(now) ?? open.at(-1)!;
  if (!open.includes(season)) {
    throw new AppError({
      code: 'VALIDATION_FAILED',
      message: '아직 열리지 않은 시즌이에요.',
      details: { reason: 'SEASON_NOT_OPEN' },
    });
  }
  return season;
}

export const careerOwnerMismatch = () =>
  new AppError({
    code: 'CAREER_OWNER_MISMATCH',
    message: '이 커리어 ID는 다른 프로필 소유입니다.',
  });

// api는 zod에 직접 의존하지 않는다 — data 타입(z.input<S>와 같은 값)은 스키마 타입의 _zod.input에서 읽는다.
type DataSchema = Parameters<typeof successEnvelope>[0];

/** 성공 응답: 봉투에 담아 contracts 스키마로 검사한 뒤 보낸다. Cache-Control은 검사를 통과한 뒤에 붙인다 —
 * 먼저 붙이면 검사 실패(503) 응답에도 공개 캐시 헤더가 따라간다. data는 스키마 입력 타입으로 컴파일 때도 맞춘다. */
export function ok<S extends DataSchema>(
  c: Context<AppEnv>,
  schema: S,
  data: S['_zod']['input'],
  status: 200 | 201 = 200,
  cacheControl?: string,
) {
  const body = successEnvelope(schema).parse({ data, meta: { requestId: c.get('requestId') } });
  if (cacheControl) c.header('Cache-Control', cacheControl);
  return c.json(body, status);
}

/** bodyGuard가 담아 둔 요청 본문을 JSON으로 읽는다(빈 본문은 {}). */
export function readJson(c: Context<AppEnv>): unknown {
  const raw = c.get('rawBody') ?? '';
  try {
    return raw.length > 0 ? JSON.parse(raw) : {};
  } catch {
    throw new AppError({
      code: 'VALIDATION_FAILED',
      message: '요청 본문이 올바른 JSON이 아닙니다.',
    });
  }
}

/** 요청 본문을 JSON으로 읽고 스키마로 검사한다. */
export const readBody = <T>(c: Context<AppEnv>, schema: SchemaLike<T>): T =>
  parseWithAppError(schema, readJson(c));
