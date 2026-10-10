import type { OwnerSummaryResponse } from '@offside/contracts';
import { cachedGet } from './client.js';

/** Shared by owner totals, admin visibility and the previous-season tier. */
export const fetchOwnerSummary = () => cachedGet<OwnerSummaryResponse>('/v1/owner/summary', 60_000);
