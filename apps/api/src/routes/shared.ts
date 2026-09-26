import { successEnvelope } from '@offside/contracts';
import type { Context } from 'hono';
import type { AppEnv } from '../env.js';
import { AppError, parseWithAppError, type SchemaLike } from '../errors.js';

export const nowIso = () => new Date().toISOString();

/** 성공 응답: 봉투에 담아 contracts 스키마로 검사한 뒤 보낸다. Cache-Control은 검사를 통과한 뒤에 붙인다 —
 * 먼저 붙이면 검사 실패(503) 응답에도 공개 캐시 헤더가 따라간다. data는 스키마 입력 타입으로 컴파일 때도 맞춘다. */
type DataSchema = Parameters<typeof successEnvelope>[0];
// api는 zod에 직접 의존하지 않는다 — z.input<S>와 같은 값을 스키마 타입에서 바로 읽는다.
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
    throw new AppError({ code: 'VALIDATION_FAILED', message: '요청 본문이 올바른 JSON이 아닙니다.' });
  }
}

/** 요청 본문을 JSON으로 읽고 스키마로 검사한다. */
export const readBody = <T>(c: Context<AppEnv>, schema: SchemaLike<T>): T => parseWithAppError(schema, readJson(c));
