import { ProfileSettingsSchema, type ProfileSettings } from '@offside/contracts';
import { eq } from 'drizzle-orm';
import type { Db } from '../client.js';
import { newId } from '../ids.js';
import { profiles } from '../schema.js';

export type ProfileRecord = {
  id: string;
  recoveryCodeHash: string | null;
  recoveryCodeIssuedAt: string | null;
  googleSub: string | null;
  email: string | null;
  linkedAt: string | null;
  tossAnonKeyHash: string | null;
  tossLinkedAt: string | null;
  settings: ProfileSettings;
  createdAt: string;
  lastSeenAt: string;
  deletedAt: string | null;
  nickname: string | null;
};

/** 로그인 수단(구글·토스)이 연결된 프로필. */
export const isLinked = (p: ProfileRecord): boolean => p.googleSub !== null || p.tossAnonKeyHash !== null;

const DEFAULT_SETTINGS: ProfileSettings = ProfileSettingsSchema.parse({
  reducedMotion: 'SYSTEM',
  textScale: 100,
  theme: 'SYSTEM',
  defaultSimulationMode: 'CHAPTER',
});

function toRecord(row: typeof profiles.$inferSelect): ProfileRecord {
  return {
    id: row.id,
    recoveryCodeHash: row.recoveryCodeHash,
    recoveryCodeIssuedAt: row.recoveryCodeIssuedAt,
    googleSub: row.googleSub,
    email: row.email,
    linkedAt: row.linkedAt,
    tossAnonKeyHash: row.tossAnonKeyHash,
    tossLinkedAt: row.tossLinkedAt,
    settings: ProfileSettingsSchema.parse(JSON.parse(row.settingsJson)),
    createdAt: row.createdAt,
    lastSeenAt: row.lastSeenAt,
    deletedAt: row.deletedAt,
    nickname: row.nickname,
  };
}

export async function createProfile(db: Db, input?: { settings?: ProfileSettings }): Promise<ProfileRecord> {
  const now = new Date().toISOString();
  const settings = input?.settings ? ProfileSettingsSchema.parse(input.settings) : DEFAULT_SETTINGS;
  const [row] = await db
    .insert(profiles)
    .values({ id: newId('prf'), settingsJson: JSON.stringify(settings), createdAt: now, lastSeenAt: now })
    .returning();
  return toRecord(row!);
}

export async function getProfile(db: Db, id: string): Promise<ProfileRecord | undefined> {
  const [row] = await db.select().from(profiles).where(eq(profiles.id, id));
  return row ? toRecord(row) : undefined;
}

/** 기존 settings와 merge한 뒤 Zod로 검증한다. 유효하지 않으면(예: `textScale: 110`) throw한다. */
export async function updateSettings(
  db: Db,
  id: string,
  partial: Partial<ProfileSettings>,
): Promise<ProfileRecord> {
  const existing = await getProfile(db, id);
  if (!existing) {
    throw new Error(`profile not found: ${id}`);
  }
  const merged = ProfileSettingsSchema.parse({ ...existing.settings, ...partial });
  const [row] = await db
    .update(profiles)
    .set({ settingsJson: JSON.stringify(merged) })
    .where(eq(profiles.id, id))
    .returning();
  return toRecord(row!);
}

/** T-10-028 댓글 닉네임을 정한다. 다른 프로필이 (대소문자만 달라도) 쓰고 있으면 'taken'. */
export async function setNickname(db: Db, id: string, nickname: string): Promise<ProfileRecord | 'taken'> {
  try {
    const [row] = await db.update(profiles).set({ nickname }).where(eq(profiles.id, id)).returning();
    return toRecord(row!);
  } catch (err) {
    // lower(nickname) 유니크 인덱스가 겹침을 막는다(자기 자신의 같은 닉네임은 겹치지 않는다).
    // drizzle는 D1 오류를 "Failed query: …"로 감싸고 원래 메시지를 cause에 둔다.
    if (`${String(err)} ${String((err as { cause?: unknown }).cause ?? '')}`.includes('UNIQUE')) return 'taken';
    throw err;
  }
}

export async function touchLastSeen(db: Db, id: string, at: string): Promise<void> {
  await db.update(profiles).set({ lastSeenAt: at }).where(eq(profiles.id, id));
}

/** D-14: 재발급하면 이전 코드는 즉시 무효(해시를 덮어쓴다). */
export async function setRecoveryCode(
  db: Db,
  id: string,
  input: { recoveryCodeHash: string; issuedAt: string },
): Promise<void> {
  await db
    .update(profiles)
    .set({ recoveryCodeHash: input.recoveryCodeHash, recoveryCodeIssuedAt: input.issuedAt })
    .where(eq(profiles.id, id));
}

/** 삭제된 프로필(`deletedAt` not null)도 존재 여부 판정을 위해 그대로 돌려준다. 호출자가 판단한다. */
export async function getProfileByRecoveryCodeHash(db: Db, hash: string): Promise<ProfileRecord | undefined> {
  const [row] = await db.select().from(profiles).where(eq(profiles.recoveryCodeHash, hash));
  return row ? toRecord(row) : undefined;
}

/** API-PRO-005: `deleted_at` 기록만 한다. 연결 데이터 삭제는 라우트가 트랜잭션으로 처리한다. */
export async function softDeleteProfile(db: Db, id: string, at: string): Promise<void> {
  await db.update(profiles).set({ deletedAt: at }).where(eq(profiles.id, id));
}

/**
 * D-21. 삭제된 프로필(`deletedAt` not null)도 존재 여부 판정을 위해 그대로 돌려준다 — 콜백은 그
 * sub를 "처음 보는 sub"로 취급해 재연결을 허용한다(delete-profile.ts가 삭제 시 google_sub를 이미
 * null로 비우므로 실무에서는 겹치지 않지만, 방어적으로 호출자가 다시 판단한다).
 */
export async function getProfileByGoogleSub(db: Db, sub: string): Promise<ProfileRecord | undefined> {
  const [row] = await db.select().from(profiles).where(eq(profiles.googleSub, sub));
  return row ? toRecord(row) : undefined;
}

/** D-21: 이미 같은 값이면 그대로 둔다(브리프: "이미 같은 값이면 그대로") — 호출자가 판단해도 되지만 항상 덮어써도 결과는 같다. */
export async function linkGoogleAccount(
  db: Db,
  id: string,
  input: { googleSub: string; email: string | null; linkedAt: string },
): Promise<void> {
  await db
    .update(profiles)
    .set({ googleSub: input.googleSub, email: input.email, linkedAt: input.linkedAt })
    .where(eq(profiles.id, id));
}

/** API-AUTH-006: `google_sub`·`email`·`linked_at`을 비운다. */
export async function unlinkGoogleAccount(db: Db, id: string): Promise<void> {
  await db.update(profiles).set({ googleSub: null, email: null, linkedAt: null }).where(eq(profiles.id, id));
}
