import type { Context } from 'hono';
import { getProfile } from '../db/repos/profiles.js';
import { getDb, type AppEnv } from '../env.js';
import { AppError } from '../errors.js';
import { resolveSession } from '../middleware/session.js';

/** T-10-011. 관리자 = 구글 계정이 연결됐고 그 (검증된) 이메일이 ADMIN_EMAILS에 있는 프로필. */
export function isAdminEmail(adminEmails: string | undefined, email: string | null): boolean {
  if (!adminEmails || !email) return false;
  const target = email.trim().toLowerCase();
  return adminEmails.split(',').some((e) => e.trim().toLowerCase() === target);
}

export type Viewer = { profileId: string | null; admin: boolean };

/** 요청한 사람. 세션이 없으면 익명(프로필을 새로 만들지 않는다). 관리자 목록이 비었으면 DB를 읽지 않는다. */
export async function getViewer(c: Context<AppEnv>): Promise<Viewer> {
  const session = await resolveSession(c);
  if (!session) return { profileId: null, admin: false };
  if (!c.env.ADMIN_EMAILS) return { profileId: session.profileId, admin: false };
  const profile = await getProfile(getDb(c), session.profileId);
  return { profileId: session.profileId, admin: !!profile?.googleSub && !profile.deletedAt && isAdminEmail(c.env.ADMIN_EMAILS, profile.email) };
}

export async function requireAdmin(c: Context<AppEnv>): Promise<Viewer> {
  const viewer = await getViewer(c);
  if (!viewer.profileId) throw new AppError({ code: 'PROFILE_REQUIRED', message: '프로필 세션이 필요합니다.' });
  if (!viewer.admin) throw new AppError({ code: 'FORBIDDEN', message: '관리자만 할 수 있습니다.' });
  return viewer;
}
