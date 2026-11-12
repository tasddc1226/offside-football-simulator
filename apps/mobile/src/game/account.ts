import { createAccountCache } from '@offside/app-core/accountCache';
import { getProfile } from '@offside/app-core/api/client';
import { noteOwner } from '@offside/app-core/api/friendPending';
import { isMember } from '@offside/app-core/account';
import { ensureSession, renewSession, sessionToken } from '../platform/session';
import { accountCache } from '../store';

const policy = createAccountCache(accountCache, () => refreshAccount());
export const { accountGeneration, ensureAccount, freshAccount, accountFresh } = policy;

/** Keep native token renewal outside the shared account-cache policy. */
export async function refreshAccount() {
  await ensureSession();
  let r = await getProfile();
  if (!r.ok && r.error.code === 'PROFILE_REQUIRED' && sessionToken()) {
    if (await renewSession()) r = await getProfile();
  }
  policy.setAccount(r.ok ? r.data : 'error');
  if (r.ok) noteOwner(isMember(r.data));
}
