import type { MembershipResponse, MemberAppearance } from '@offside/contracts/membership';
import { apiFetch, cachedGet, invalidateApiCache } from './client.js';
export type {
  MembershipResponse,
  MembershipState,
  MemberAppearance,
} from '@offside/contracts/membership';
export const fetchMembership = (fresh = false) => {
  if (fresh) invalidateApiCache('/v1/membership');
  return cachedGet<MembershipResponse>('/v1/membership', 60_000);
};
export const claimMembership = (store: 'apple' | 'google', token: string) =>
  apiFetch<MembershipResponse>('/v1/membership/claim', {
    method: 'POST',
    body: JSON.stringify({ store, token, productId: 'com.offsidelab.app.club_monthly' }),
  });
export const saveMemberAppearance = (appearance: Pick<MemberAppearance, 'theme' | 'frame'>) =>
  apiFetch<MembershipResponse>('/v1/membership/appearance', {
    method: 'PUT',
    body: JSON.stringify(appearance),
  });
