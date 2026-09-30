import type { Db } from '../client.js';
import { newId } from '../ids.js';
import { auditLog } from '../schema.js';

export type AuditLogKind = (typeof auditLog.$inferSelect)['kind'];

type AuditLogInput = {
  kind: AuditLogKind;
  profileId: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

/** batch에 함께 넣을 감사 로그 insert 문. */
export const auditLogStatement = (db: Db, input: AuditLogInput) =>
  db.insert(auditLog).values({
    id: newId('aud'),
    kind: input.kind,
    profileId: input.profileId,
    payloadJson: JSON.stringify(input.payload),
    createdAt: input.createdAt,
  });

export async function insertAuditLog(db: Db, input: AuditLogInput): Promise<void> {
  await auditLogStatement(db, input);
}
