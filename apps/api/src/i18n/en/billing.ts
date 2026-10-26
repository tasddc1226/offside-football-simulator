import type { billing as ko } from '../ko/billing.js';
export const billing: typeof ko = {
  kinds: {
    purchase: '💳 New purchase',
    renewal: '🔄 Subscription renewal',
    refund: '↩️ Refund',
    test: '🧪 Connection test',
  },
  webKinds: {
    purchase: '🌐 Web purchase',
    refund: '↩️ Web purchase refund',
  },
  channel: 'Channel',
  channels: { app: 'In-app purchase', web: 'Web purchase (offside-lab.com)' },
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
  membership: 'Club membership (monthly)',
  removeAds: 'Remove ads',
  items: {
    reroll: 'Reroll tickets',
    boost: 'Potential boost tickets',
    scout: 'Premium scout tickets',
    rename: 'Player rename tickets',
  },
  quantity: (name: string, qty: number) => `${name} × ${qty}`,
};
