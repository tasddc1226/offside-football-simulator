import type { Db } from '../client.js';
import { newId } from '../ids.js';
import { auditLog } from '../schema.js';

export type AuditLogKind = (typeof auditLog.$inferSelect)['kind'];

export async function insertAuditLog(
  db: Db,
  input: {
    kind: AuditLogKind;
    profileId: string;
    payload: Record<string, unknown>;
    createdAt: string;
  },
): Promise<void> {
  await db.insert(auditLog).values({
    id: newId('aud'),
    kind: input.kind,
    profileId: input.profileId,
    payloadJson: JSON.stringify(input.payload),
    createdAt: input.createdAt,
  });
}
