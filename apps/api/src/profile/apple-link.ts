import type { Db } from '../db/client.js';
import { insertAuditLog } from '../db/repos/auditLog.js';
import { getProfileByAppleSub, linkAppleAccount } from '../db/repos/profiles.js';
import { resolveSignIn, type SignInOutcome } from './google-link.js';

/** T-11-003 Sign in with Apple — 구글 콜백과 같은 규칙(resolveSignIn). 이미 연결된 Apple ID면 아무것도 쓰지 않는다. */
export async function resolveAppleSignIn(
  db: Db,
  input: { sub: string; currentProfileId: string; now: string },
): Promise<SignInOutcome> {
  return resolveSignIn(db, {
    target: await getProfileByAppleSub(db, input.sub),
    currentProfileId: input.currentProfileId,
    now: input.now,
    link: async (current) => {
      if (current.appleSub === input.sub) return;
      await linkAppleAccount(db, current.id, { appleSub: input.sub, linkedAt: input.now });
      await insertAuditLog(db, {
        kind: 'APPLE_LINKED',
        profileId: current.id,
        payload: {},
        createdAt: input.now,
      });
    },
  });
}
