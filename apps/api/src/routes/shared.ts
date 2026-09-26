import { successEnvelope } from '@offside/contracts';
import type { Context } from 'hono';
import type { AppEnv } from '../env.js';
import { parseJsonBody, parseWithAppError, type SchemaLike } from '../errors.js';

/** 성공 응답 봉투. */
const envelope = (c: Context<AppEnv>, data: unknown) => ({ data, meta: { requestId: c.get('requestId') } });
export const nowIso = () => new Date().toISOString();

/** 성공 응답: 봉투에 담아 contracts 스키마로 검사한 뒤 보낸다. */
export const ok = (c: Context<AppEnv>, schema: Parameters<typeof successEnvelope>[0], data: unknown, status: 200 | 201 = 200) =>
  c.json(successEnvelope(schema).parse(envelope(c, data)), status);

/** bodyGuard가 담아 둔 요청 본문을 JSON으로 읽는다(빈 본문은 {}). */
export const readJson = (c: Context<AppEnv>): unknown => parseJsonBody(c.get('rawBody') ?? '');
/** 요청 본문을 JSON으로 읽고 스키마로 검사한다. */
export const readBody = <T>(c: Context<AppEnv>, schema: SchemaLike<T>): T => parseWithAppError(schema, readJson(c));
