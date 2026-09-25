import type { Context } from 'hono';
import type { AppEnv } from '../env.js';

/** 성공 응답 봉투. 스키마 검사는 각 라우트가 `successEnvelope(Schema).parse(...)`로 한다. */
export const envelope = (c: Context<AppEnv>, data: unknown) => ({ data, meta: { requestId: c.get('requestId') } });
export const nowIso = () => new Date().toISOString();
