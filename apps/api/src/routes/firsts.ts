import { FirstsResponseSchema, SeasonPickQuerySchema } from '@offside/contracts';
import { displaySeasonAt } from '@offside/contracts/service-seasons';
import type { Context, Hono } from 'hono';
import { ensureFirstsBackfilled, listFirsts, recordCareerFirsts } from '../db/repos/firsts.js';
import { edgeCached, purgeEdge } from '../edgeCache.js';
import { EDGE, STALE } from '../edgeKeys.js';
import { getDb, type AppEnv } from '../env.js';
import { localizeFirsts } from '../firstsText.js';
import { reqLang } from '../lang.js';
import { parseWithAppError } from '../errors.js';
import { nowIso, ok } from './shared.js';

// T-10-027 서버 최초 기록 · T-10-056 서버 기록. 로그인 없이 누구나 읽는다 — 응답엔 기록 문장·시각과 명예의 전당에
// 이름 공개를 고른 이름만 있다. 목록은 새 기록이 1분 안에 보이게 짧게 캐시하고, 기록이 바뀌면 지운다.
const TTL = 60;

/** 시즌·은퇴 업로드 뒤에 부른다. 판정이 실패해도 업로드 응답은 그대로 성공시키고 로그로만 남긴다
 * (빠진 기록은 다음 업로드나 전체 재계산이 채운다). */
export async function recordFirsts(
  c: Context<AppEnv>,
  careerId: string,
  opts?: { legendOnly?: boolean },
): Promise<void> {
  try {
    if (await recordCareerFirsts(getDb(c), careerId, opts)) purgeEdge(c, STALE.firstsChanged());
  } catch (err) {
    c.set('storeFailure', {
      code: 'SERVER_FIRSTS_FAILED',
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

export function registerFirstsRoutes(app: Hono<AppEnv>): void {
  app.get('/v1/firsts', async (c) => {
    // T-11-029 시즌별 기록 — ?season= 없으면 지금 시즌(개막 전이면 프리시즌, 휴식기면 마지막 시즌). 캐시 키는 시즌을 푼 경로다.
    const season =
      parseWithAppError(SeasonPickQuerySchema, c.req.query('season')) ?? displaySeasonAt(nowIso());
    // 다시 훑는 중이어도 캐시한다 — 나머지는 5분 cron(runFirstsRescan)이 몰아서 훑고, 여기선 캐시가 빌 때 한 조각만 돕는다(T-11-156).
    const data = await edgeCached(c, EDGE.firsts(season), TTL, async () => {
      const db = getDb(c);
      await ensureFirstsBackfilled(db);
      return listFirsts(db, season);
    });
    // 캐시에는 한국어 원본을 담고(키가 언어마다 늘지 않는다) 읽은 뒤에 요청 언어로 문구만 바꾼다.
    return ok(
      c,
      FirstsResponseSchema,
      localizeFirsts(data, reqLang(c)),
      200,
      `public, max-age=${TTL}`,
    );
  });
}
