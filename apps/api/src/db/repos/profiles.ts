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
};

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
