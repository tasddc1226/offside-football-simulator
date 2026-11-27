import type { RetiredPhysique } from '@offside/contracts/body';
import { apiFetch, invalidateApiCache, ownerCachedGet } from './client.js';
const path = (id: string) => `/v1/cards/${encodeURIComponent(id)}/physique`;
export const fetchCardPhysique = (id: string) => ownerCachedGet<RetiredPhysique>(path(id), 30_000);
export const saveCardPhysique = async (
  id: string,
  height: number,
  weight: number,
  expectedRevision: number,
) => {
  const result = await apiFetch<RetiredPhysique>(path(id), {
    method: 'POST',
    body: JSON.stringify({ height, weight, expectedRevision }),
  });
  if (!result.ok) invalidateApiCache(path(id));
  return result;
};
