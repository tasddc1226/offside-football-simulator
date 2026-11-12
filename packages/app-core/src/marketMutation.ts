import { isStaleListing, type MarketListing } from './api/market.js';

export type MarketMutationError = { message: string; reason?: string | undefined };
export type MarketMutationResult<T> =
  { ok: true; data: T } | { ok: false; error: MarketMutationError };

/** Preserve the trade UI ordering, including the busy lock while stale listings refresh. */
export async function runMarketMutation<T>(
  send: () => Promise<MarketMutationResult<T>>,
  done: string,
  host: {
    sent: MarketListing | null;
    setBusy: (busy: boolean) => void;
    setError: (error: string | null) => void;
    settleStale: (sent: MarketListing | null, error: MarketMutationError) => Promise<void>;
    clearAfterSuccess: () => void;
    notify: (message: string) => void;
    refresh: () => Promise<unknown>;
  },
): Promise<boolean> {
  host.setBusy(true);
  host.setError(null);
  const r = await send();
  if (!r.ok) {
    if (isStaleListing(r.error)) await host.settleStale(host.sent, r.error);
    else host.setError(r.error.message);
    host.setBusy(false);
    return false;
  }
  host.setBusy(false);
  host.clearAfterSuccess();
  host.notify(done);
  await host.refresh();
  return true;
}
