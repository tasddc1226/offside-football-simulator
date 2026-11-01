import type { Context } from 'hono';
import { getProfile, hasAccount, type ProfileRecord } from '../db/repos/profiles.js';
import { getDb, type AppEnv } from '../env.js';
import { AppError } from '../errors.js';
import { getSessionOrThrow } from './requireProfile.js';

/** 구글 로그인한(삭제되지 않은) 프로필만 구단주다. 익명 프로필은 403 GOOGLE_LOGIN_REQUIRED — 웹이 로그인 안내를 띄운다. */
export async function requireOwner(c: Context<AppEnv>): Promise<ProfileRecord> {
  const profile = await getProfile(getDb(c), getSessionOrThrow(c).profileId);
  if (!profile || !hasAccount(profile) || profile.deletedAt) {
    throw new AppError({
      code: 'FORBIDDEN',
      message: '로그인하면 팀을 만들 수 있어요.',
      details: { reason: 'GOOGLE_LOGIN_REQUIRED' },
    });
  }
  return profile;
}
