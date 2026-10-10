import type { StrengthHistory } from '@offside/contracts/club-strength';
import { cachedGet, invalidateApiCache } from './client.js';
export type { StrengthHistory };
export function fetchStrengthHistory(before?: string, fresh = false) {
  const path = '/v1/admin/club-strength' + (before ? `?before=${encodeURIComponent(before)}` : '');
  if (fresh) invalidateApiCache(path);
  return cachedGet<StrengthHistory>(path, 60_000);
}
