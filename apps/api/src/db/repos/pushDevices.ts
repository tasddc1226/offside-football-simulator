import type { RegisterPushDevice } from '@offside/contracts';
import type { SessionContext } from '../../env.js';
import { sha256Hex } from '../hash.js';
import { conflictError } from '../../routes/shared.js';

export async function registerPushDevice(
  db: D1Database,
  session: SessionContext,
  input: RegisterPushDevice,
  now: string,
) {
  const hash = await sha256Hex(input.installationId);
  // 같은 기기의 계정 전환은 재바인딩한다. 다른 기기의 토큰을 빼앗지는 못한다.
  const r = await db
    .prepare(
      `INSERT INTO push_devices (installation_hash, session_id, profile_id, token, platform, app_version, updated_at)
    SELECT ?, ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM push_devices WHERE token = ? AND installation_hash <> ?)
    ON CONFLICT(installation_hash) DO UPDATE SET session_id = excluded.session_id, profile_id = excluded.profile_id,
    last_test_ticket_id = CASE WHEN token = excluded.token AND session_id = excluded.session_id THEN last_test_ticket_id ELSE NULL END,
    last_test_sent_at = CASE WHEN token = excluded.token AND session_id = excluded.session_id THEN last_test_sent_at ELSE NULL END,
    token = excluded.token, platform = excluded.platform, app_version = excluded.app_version, updated_at = excluded.updated_at`,
    )
    .bind(
      hash,
      session.id,
      session.profileId,
      input.token,
      input.platform,
      input.appVersion,
      now,
      input.token,
      hash,
    )
    .run();
  if (r.meta.changes !== 1)
    throw conflictError('이 기기의 알림을 다시 연결해 주세요.', 'PUSH_TOKEN_CONFLICT');
}

/** 발송 중 계정·토큰이 바뀌면 이전 요청의 접수 번호를 새 등록에 남기지 않는다. */
export async function rememberPushTestTicket(
  db: D1Database,
  installationId: string,
  expected: { token: string; sessionId: string },
  ticketId: string,
  sentAt: string,
) {
  await db
    .prepare(
      `UPDATE push_devices SET last_test_ticket_id = ?, last_test_sent_at = ?
       WHERE installation_hash = ? AND token = ? AND session_id = ?`,
    )
    .bind(ticketId, sentAt, await sha256Hex(installationId), expected.token, expected.sessionId)
    .run();
}

/** 설치 식별자는 보안 저장소에만 있다. 새 익명 세션에서도 이 기기의 이전 등록을 철회할 수 있다. */
export async function unregisterPushDevice(
  db: D1Database,
  installationId: string,
  expected?: { token: string; sessionId: string },
) {
  if (expected) {
    await db
      .prepare(
        'DELETE FROM push_devices WHERE installation_hash = ? AND token = ? AND session_id = ?',
      )
      .bind(await sha256Hex(installationId), expected.token, expected.sessionId)
      .run();
    return;
  }
  await db
    .prepare('DELETE FROM push_devices WHERE installation_hash = ?')
    .bind(await sha256Hex(installationId))
    .run();
}

export async function ownPushDevice(
  db: D1Database,
  session: SessionContext,
  installationId: string,
  now: string,
) {
  return db
    .prepare(
      `SELECT d.token FROM push_devices d JOIN sessions s ON s.id = d.session_id
    JOIN profiles p ON p.id = d.profile_id WHERE d.installation_hash = ? AND d.session_id = ?
    AND d.profile_id = ? AND s.profile_id = d.profile_id AND s.revoked_at IS NULL AND s.expires_at > ? AND p.deleted_at IS NULL
    AND d.updated_at >= ?`,
    )
    .bind(
      await sha256Hex(installationId),
      session.id,
      session.profileId,
      now,
      new Date(Date.parse(now) - 90 * 86400_000).toISOString(),
    )
    .first<{ token: string }>();
}
