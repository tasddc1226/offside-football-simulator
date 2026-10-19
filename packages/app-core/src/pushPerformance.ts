import type { PushCategory, PushMetrics } from '@offside/contracts';

export { adminPush as pushAdminText } from './i18n/ko/adminPush';
import { adminPush as L } from './i18n/ko/adminPush';
export const PUSH_CATEGORY_LABELS: Record<PushCategory, string> = {
  get notice() {
    return L.notice;
  },
  get release() {
    return L.release;
  },
  get team() {
    return L.team;
  },
  get market() {
    return L.market;
  },
  get social() {
    return L.social;
  },
  get community() {
    return L.community;
  },
  get 'friend-request'() {
    return L.friendRequest;
  },
  get 'friend-accepted'() {
    return L.friendAccepted;
  },
  get friendly() {
    return L.friendly;
  },
  get return() {
    return L.return;
  },
  get test() {
    return L.test;
  },
};
export const pushClickRate = (m: PushMetrics) =>
  m.acceptedRecipients ? `${((m.clicked / m.acceptedRecipients) * 100).toFixed(1)}%` : '—';
export const PUSH_METRIC_LABELS = [
  {
    key: 'queued',
    get label() {
      return L.queued;
    },
  },
  {
    key: 'accepted',
    get label() {
      return L.deviceAccepted;
    },
  },
  {
    key: 'confirmed',
    get label() {
      return L.providerConfirmed;
    },
  },
  {
    key: 'pending',
    get label() {
      return L.pending;
    },
  },
  {
    key: 'failed',
    get label() {
      return L.failed;
    },
  },
  {
    key: 'unknown',
    get label() {
      return L.unknown;
    },
  },
  {
    key: 'cancelled',
    get label() {
      return L.cancelled;
    },
  },
] as const;
export const pushStatus = (m: PushMetrics) =>
  [
    ...(m.waiting === undefined
      ? [[L.pending, m.pending] as const]
      : [
          [L.waiting, m.waiting] as const,
          [L.sending, m.sending ?? 0] as const,
          [L.checking, m.checking ?? 0] as const,
        ]),
    [L.failed, m.failed] as const,
    [L.unknown, m.unknown] as const,
    [L.cancelled, m.cancelled] as const,
  ]
    .filter(([, n]) => n > 0)
    .map(([label, n]) => `${label} ${n.toLocaleString()}`)
    .join(' · ');

export { retention as retentionText } from './i18n/ko/retention';
export const RETENTION_METRICS = [
  'recipients',
  'acceptedRecipients',
  'confirmed',
  'clicked',
  'returned',
  'retired',
  'pending',
  'cancelled',
  'failed',
  'unknown',
] as const;

export { cupPush as cupPushText } from './i18n/ko/cupPush';
export const CUP_AUDIENCE_METRICS = [
  'recipients',
  'participants',
  'predictors',
  'overlap',
  'predictionOnly',
  'predictionEntries',
  'duplicatesRemoved',
  'notQueued',
] as const;
export const CUP_DELIVERY_METRICS = [
  'queued',
  'acceptedRecipients',
  'confirmed',
  'clicked',
  'targetOpened',
  'pending',
  'failed',
  'unknown',
  'cancelled',
] as const;
