import type { billing as ko } from '../ko/billing.js';
export const billing: typeof ko = {
  kinds: {
    purchase: '💳 New purchase',
    renewal: '🔄 Subscription renewal',
    refund: '↩️ Refund',
    test: '🧪 Connection test',
  },
  live: 'Live payment',
  sandbox: 'Test · Sandbox',
  product: 'Product',
  store: 'Store',
  received: 'Notification received',
  timezone: 'KST',
  reference: 'Alert reference',
  productId: 'Product ID',
  testNotice: 'Test notification. Do not count this as revenue.',
  testProduct: 'Store notification connection check',
  removeAds: 'Remove ads',
  items: {
    reroll: 'Reroll tickets',
    boost: 'Potential boost tickets',
    scout: 'Premium scout tickets',
    rename: 'Player rename tickets',
  },
  quantity: (name: string, qty: number) => `${name} × ${qty}`,
};
