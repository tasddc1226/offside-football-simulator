import { describe, it, expect } from 'vitest';
import { verifiedPurchaseMetadata } from './metadata.js';
describe('verified store metadata', () => {
  it('preserves signed milliunits, currency, storefront and original purchase time', () => {
    expect(
      verifiedPurchaseMetadata({
        purchaseDate: 1700000000000,
        price: 4990000,
        currency: 'KRW',
        storefront: 'KOR',
      }),
    ).toEqual({
      purchasedAt: '2023-11-14T22:13:20.000Z',
      priceMilliunits: 4990000,
      currency: 'KRW',
      storefront: 'KOR',
    });
  });
  it('does not invent money or timestamps for legacy, Google, or malformed fields', () => {
    for (const input of [
      {},
      { price: 4990 },
      { price: -1, currency: 'KRW' },
      { price: '4990', currency: 'KRW' },
      { purchaseDate: Infinity },
      { purchaseDate: NaN },
      { price: 1.5, currency: 'KRW' },
    ])
      expect(verifiedPurchaseMetadata(input)).toEqual({
        purchasedAt: null,
        priceMilliunits: null,
        currency: null,
        storefront: null,
      });
  });
});
