import { describe, expect, it } from 'vitest';
import type { MarketListing } from './api/market.js';
import { staleListingNext } from './market.js';
import { marketText as L } from './i18n/ko/market.js';
import { fmtValue } from './format.js';

const listing = (id: string, price: number) => ({ id, price }) as MarketListing;

describe('staleListingNext (T-11-434)', () => {
  it('swaps the sheet to the new price when the fresh list has the listing at another price', () => {
    const fresh = [listing('a', 1_500), listing('b', 900)];
    const next = staleListingNext({ id: 'a', price: 1_200 }, 'PRICE_CHANGED', fresh);
    expect(next).toEqual({
      listing: fresh[0],
      notice: L.priceMoved({ price: fmtValue(1_500) }),
    });
  });
  it('closes with a toast when the listing is gone', () => {
    expect(
      staleListingNext({ id: 'a', price: 1_200 }, 'LISTING_GONE', [listing('a', 1_500)]),
    ).toEqual({ toast: L.staleGone });
  });
  it.each([
    ['missing from the fresh page', [listing('b', 900)]],
    ['still at the rejected price (edge cache)', [listing('a', 1_200)]],
    ['when the list failed to load', null],
  ])('never resends the rejected price: closes when %s', (_, fresh) => {
    expect(staleListingNext({ id: 'a', price: 1_200 }, 'PRICE_CHANGED', fresh)).toEqual({
      toast: L.staleRecheck,
    });
  });
});
