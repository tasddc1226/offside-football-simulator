// 댓글 쓰기 공통 문턱(게시판 글 · 팀 프로필). 비속어, 구글 로그인, 닉네임, 시간당 개수(관리자 제외).
import type { Context } from 'hono';
import { hasProfanity } from '@offside/contracts/content-filter';
import { getViewer, type Viewer } from '../auth/admin.js';
import { getDb, type AppEnv } from '../env.js';
import { AppError } from '../errors.js';
import { getSessionOrThrow } from '../middleware/requireProfile.js';
import { enforceLimit } from './shared.js';

/** 프로필당 시간당 댓글 수(게시판·팀 댓글이 한 바구니를 쓴다). */
export const COMMENT_LIMIT = 10;

export async function assertCanComment(
  c: Context<AppEnv>,
  body: string,
  now: string,
): Promise<{ viewer: Viewer; nickname: string; profileId: string }> {
  if (hasProfanity(body)) {
    throw new AppError({
      code: 'VALIDATION_FAILED',
      message: '쓸 수 없는 표현이 들어 있어요.',
      details: { reason: 'BLOCKED_WORD' },
    });
  }
  const viewer = await getViewer(c);
  // T-10-028: 댓글은 구글 로그인한 프로필만, 그 프로필의 닉네임으로.
  if (!viewer.google)
    throw new AppError({
      code: 'FORBIDDEN',
      message: '로그인하면 댓글을 쓸 수 있어요.',
      details: { reason: 'GOOGLE_LOGIN_REQUIRED' },
    });
  const nickname = viewer.nickname;
  if (!nickname)
    throw new AppError({
      code: 'FORBIDDEN',
      message: '댓글에 쓸 닉네임을 먼저 정해 주세요.',
      details: { reason: 'NICKNAME_REQUIRED' },
    });
  const profileId = getSessionOrThrow(c).profileId;
  if (!viewer.admin) {
    await enforceLimit(
      getDb(c),
      'BOARD_COMMENT',
      profileId,
      COMMENT_LIMIT,
      now,
      '댓글을 너무 자주 쓰고 있어요. 잠시 뒤에 다시 시도해 주세요.',
    );
  }
  return { viewer, nickname, profileId };
}
