import type { NotificationContent } from '@offside/contracts';
import { isAdminEmail } from '../auth/admin.js';
import type { Bindings } from '../env.js';
import { eventNotificationStatements } from './events.js';
import { communityPushText } from '../i18n/ko/communityPush.js';

/** Never fan out to every admin: a multi-admin installation needs one explicit recipient. */
export function communityOwnerEmail(env: Bindings): string | null {
  if (env.ADMIN_COMMUNITY_PUSH_ENABLED !== '1') return null;
  const admins = (env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  const email = (env.ADMIN_COMMUNITY_PUSH_EMAIL ?? (admins.length === 1 ? (admins[0] ?? '') : ''))
    .trim()
    .toLowerCase();
  return email && !email.includes(',') && isAdminEmail(env.ADMIN_EMAILS, email) ? email : null;
}

/** Start from registered devices and indexed profile IDs, rather than scanning all profiles. */
export async function communityRecipients(env: Bindings): Promise<string[]> {
  const email = communityOwnerEmail(env);
  if (!email) return [];
  const rows = await env.DB.prepare(
    `SELECT p.id AS profile_id FROM profiles p
    WHERE p.id IN (SELECT d.profile_id FROM push_devices d JOIN sessions s ON s.id = d.session_id
      WHERE s.channel = 'app' AND s.profile_id = d.profile_id AND s.revoked_at IS NULL
        AND s.expires_at > ? AND d.updated_at >= ?)
      AND lower(trim(p.email)) = ? AND p.google_sub IS NOT NULL AND p.deleted_at IS NULL`,
  )
    .bind(new Date().toISOString(), new Date(Date.now() - 90 * 86400_000).toISOString(), email)
    .all<{ profile_id: string }>();
  return rows.results.map((r) => r.profile_id);
}

export type CommunityEvent = {
  id: string;
  profileId: string;
  nickname: string;
  body: string;
  admin: boolean;
  now: string;
} & ({ type: 'comment'; board: 'notice' | 'release'; postId: string } | { type: 'chat' });

/** Source IDs deduplicate DO alarm retries; original comment and notification commit together. */
export function communityStatements(env: Bindings, recipients: string[], event: CommunityEvent) {
  if (event.admin) return [];
  const email = communityOwnerEmail(env);
  if (!email) return [];
  const content: NotificationContent = {
    kind: 'community',
    title: event.type === 'comment' ? communityPushText.comment : communityPushText.chat,
    body: `${event.nickname}: ${event.body}`.slice(0, 160),
    target:
      event.type === 'comment'
        ? { type: 'board', board: event.board, postId: event.postId }
        : { type: 'screen', screen: 'chat' },
  };
  return recipients
    .filter((id) => id !== event.profileId)
    .flatMap((profileId) =>
      eventNotificationStatements(
        env.DB,
        {
          profileId,
          sourceKey: `admin-community-${event.type}:${event.id}`,
          content,
          now: event.now,
        },
        {
          sql: `google_sub IS NOT NULL AND lower(trim(email)) = ?`,
          params: [email],
        },
      ),
    );
}
