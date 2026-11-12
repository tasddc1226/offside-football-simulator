import { describe, expect, it } from 'vitest';
import {
  runMarketMutation,
  type MarketMutationError,
  type MarketMutationResult,
} from './marketMutation.js';
import type { MarketListing } from './api/market.js';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => (resolve = done));
  return { promise, resolve };
}
function setup() {
  const events: unknown[] = [];
  const listing = { id: 'sent-listing' } as MarketListing;
  const host = {
    sent: listing,
    setBusy: (value: boolean) => events.push(['busy', value]),
    setError: (value: string | null) => events.push(['error', value]),
    settleStale: async (sent: MarketListing | null, error: MarketMutationError) => {
      events.push(['stale', sent, error.reason]);
    },
    clearAfterSuccess: () => {
      events.push('clear');
    },
    notify: (message: string) => {
      events.push(['notify', message]);
    },
    refresh: async () => {
      events.push('refresh');
    },
  };
  return { events, listing, host };
}

describe('market mutation UI ordering', () => {
  it('unlocks, clears selection and notifies before awaiting the success refresh', async () => {
    const { events, host } = setup();
    const refresh = deferred<void>();
    host.refresh = () => {
      events.push('refresh');
      return refresh.promise;
    };
    let finished = false;
    const result = runMarketMutation(async () => ({ ok: true, data: {} }), 'done', host).then(
      (r) => {
        finished = true;
        return r;
      },
    );
    await Promise.resolve();
    expect(events).toEqual([
      ['busy', true],
      ['error', null],
      ['busy', false],
      'clear',
      ['notify', 'done'],
      'refresh',
    ]);
    expect(finished).toBe(false);
    refresh.resolve();
    expect(await result).toBe(true);
  });

  it.each(['PRICE_CHANGED', 'LISTING_GONE'])(
    'keeps the busy lock throughout %s reconciliation',
    async (reason) => {
      const { events, host, listing } = setup();
      const stale = deferred<void>();
      host.settleStale = (sent, error) => {
        events.push(['stale', sent, error.reason]);
        return stale.promise;
      };
      const response = deferred<MarketMutationResult<never>>();
      const result = runMarketMutation(() => response.promise, 'done', host);
      response.resolve({ ok: false, error: { message: 'stale', reason } });
      await Promise.resolve();
      expect(events).toEqual([
        ['busy', true],
        ['error', null],
        ['stale', listing, reason],
      ]);
      stale.resolve();
      expect(await result).toBe(false);
      expect(events.at(-1)).toEqual(['busy', false]);
      expect(events).not.toContain('clear');
      expect(events).not.toContain('refresh');
    },
  );

  it('shows ordinary errors without refreshing or clearing the current selection', async () => {
    const { events, host } = setup();
    expect(
      await runMarketMutation(
        async () => ({ ok: false, error: { message: 'unavailable' } }),
        'done',
        host,
      ),
    ).toBe(false);
    expect(events).toEqual([
      ['busy', true],
      ['error', null],
      ['error', 'unavailable'],
      ['busy', false],
    ]);
  });
});
