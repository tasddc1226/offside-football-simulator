import { ADMIN_NICKNAME } from '@offside/contracts';
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

type IdentityProfile = { googleSub: string | null; email: string | null; nickname: string | null; deletedAt: string | null };
export type CommentIdentity = { google: boolean; admin: boolean; nickname: string | null };

/**
 * T-10-028 댓글 자격 — 구글 로그인(삭제되지 않은 프로필), 관리자 여부, 댓글 닉네임. 관리자 닉네임은 언제나
 * '운영자'다. viewer·프로필 응답·닉네임 변경이 모두 이 한 곳의 판단을 쓴다.
 */
export function commentIdentity(profile: IdentityProfile | undefined, adminEmails: string | undefined): CommentIdentity {
  const google = !!profile?.googleSub && !profile.deletedAt;
  const admin = google && isAdminEmail(adminEmails, profile.email);
  return { google, admin, nickname: admin ? ADMIN_NICKNAME : google ? profile.nickname : null };
}

export type Viewer = CommentIdentity & { profileId: string | null };

/** 요청한 사람. 세션이 없으면 익명(프로필을 새로 만들지 않는다). T-10-028: 댓글 자격(구글 로그인·닉네임)도 함께 본다. */
export async function getViewer(c: Context<AppEnv>): Promise<Viewer> {
  const session = await resolveSession(c);
  if (!session) return { profileId: null, admin: false, google: false, nickname: null };
  const profile = await getProfile(getDb(c), session.profileId);
  return { profileId: session.profileId, ...commentIdentity(profile, c.env.ADMIN_EMAILS) };
}

export async function requireAdmin(c: Context<AppEnv>): Promise<Viewer> {
  const viewer = await getViewer(c);
  if (!viewer.profileId) throw new AppError({ code: 'PROFILE_REQUIRED', message: '프로필 세션이 필요합니다.' });
  if (!viewer.admin) throw new AppError({ code: 'FORBIDDEN', message: '관리자만 할 수 있습니다.' });
  return viewer;
}
