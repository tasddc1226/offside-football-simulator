import { FirstsResponseSchema } from '@offside/contracts';
import type { Context, Hono } from 'hono';
import { ok } from './shared.js';
import { ensureFirstsBackfilled, listFirsts, recordCareerFirsts } from '../db/repos/firsts.js';
import { edgeCached, purgeEdge } from '../edgeCache.js';
import { EDGE, STALE } from '../edgeKeys.js';
import { getDb, type AppEnv } from '../env.js';

// T-10-027 서버 최초 기록. 로그인 없이 누구나 읽는다 — 응답엔 기록 문장·시각과 명예의 전당에
// 이름 공개를 고른 이름만 있다. 목록은 새 기록이 1분 안에 보이게 짧게 캐시하고, 기록이 바뀌면 지운다.
const TTL = 60;

/** 시즌·은퇴 업로드 뒤에 부른다. 판정이 실패해도 업로드 응답은 그대로 성공시키고 로그로만 남긴다
 * (빠진 기록은 다음 업로드나 BACKFILL_VERSION 재계산이 채운다). */
export async function recordFirsts(c: Context<AppEnv>, careerId: string, opts?: { legendOnly?: boolean }): Promise<void> {
  try {
    if (await recordCareerFirsts(getDb(c), careerId, opts)) purgeEdge(c, STALE.firstsChanged());
  } catch (err) {
    c.set('storeFailure', { code: 'SERVER_FIRSTS_FAILED', message: err instanceof Error ? err.message : String(err) });
  }
}

export function registerFirstsRoutes(app: Hono<AppEnv>): void {
  app.get(EDGE.firsts, async (c) => {
    const data = await edgeCached(c, EDGE.firsts, TTL, async () => {
      const db = getDb(c);
      await ensureFirstsBackfilled(db);
      return { items: await listFirsts(db) };
    });
    return ok(c, FirstsResponseSchema, data, 200, `public, max-age=${TTL}`);
  });
}
