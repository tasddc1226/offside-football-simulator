import { PublishedReleaseNotesSchema, PublishReleaseNotesSchema } from '@offside/contracts';
import type { Hono } from 'hono';
import { verifyGithubRelease } from '../auth/github-release.js';
import { publishReleaseNotes } from '../db/repos/releaseNotes.js';
import { purgeEdge } from '../edgeCache.js';
import { STALE } from '../edgeKeys.js';
import type { AppEnv } from '../env.js';
import { AppError } from '../errors.js';
import { NO_STORE, nowIso, ok, readBody } from './shared.js';
import { kickNewsPush } from '../push/dispatch.js';

export function registerReleaseNoteRoutes(app: Hono<AppEnv>): void {
  app.post('/v1/internal/release-notes', async (c) => {
    const input = readBody(c, PublishReleaseNotesSchema);
    const token = /^Bearer ([^ ]+)$/.exec(c.req.header('Authorization') ?? '')?.[1];
    try {
      if (c.env.ENVIRONMENT !== 'production' || !token) throw new Error('Not a release job');
      await verifyGithubRelease(token, input.sha);
    } catch {
      throw new AppError({
        code: 'FORBIDDEN',
        message: '운영 배포 작업만 릴리즈 노트를 게시할 수 있어요.',
      });
    }
    const result = await publishReleaseNotes(c.env.DB, input, nowIso());
    if (result.updated) {
      purgeEdge(c, STALE.boardChanged('release'));
      kickNewsPush(c);
    }
    return ok(c, PublishedReleaseNotesSchema, result, 200, NO_STORE);
  });
}
