import type { RetiredNumberProgress } from '@offside/contracts';
import { cachedGet } from './client.js';

// Shared web/native cache. Successful season uploads clear the API cache via the outbox.
export const fetchRetiredNumberProgress = (careerId: string, number: number) =>
  cachedGet<RetiredNumberProgress>(
    `/v1/careers/${encodeURIComponent(careerId)}/retired-number-progress?number=${number}`,
    5 * 60_000,
  );
