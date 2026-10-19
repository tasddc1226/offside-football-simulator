export type VerifiedPurchaseMetadata = {
  purchasedAt: string | null;
  priceMilliunits: number | null;
  currency: string | null;
  storefront: string | null;
};
export function verifiedPurchaseMetadata(input: {
  purchaseDate?: unknown;
  price?: unknown;
  currency?: unknown;
  storefront?: unknown;
}): VerifiedPurchaseMetadata {
  const ms = input.purchaseDate;
  const purchasedAt =
    typeof ms === 'number' && Number.isSafeInteger(ms) && ms > 0 && ms <= 8.64e15
      ? new Date(ms).toISOString()
      : null;
  const validMoney =
    typeof input.price === 'number' &&
    Number.isSafeInteger(input.price) &&
    input.price >= 0 &&
    typeof input.currency === 'string' &&
    /^[A-Z]{3}$/.test(input.currency);
  return {
    purchasedAt,
    priceMilliunits: validMoney ? (input.price as number) : null,
    currency: validMoney ? (input.currency as string) : null,
    storefront:
      typeof input.storefront === 'string' && /^[A-Z]{3}$/.test(input.storefront)
        ? input.storefront
        : null,
  };
}
