import { z } from 'zod';

export const MEMBERSHIP_PRODUCT = 'com.offsidelab.app.club_monthly';
export const MEMBERSHIP_VERSION = 1;
export const MEMBERSHIP_BONUS = { reroll: 40, scout: 5, boost: 10 } as const;
export const MEMBER_THEMES = ['classic', 'midnight', 'ivory', 'royal'] as const;
export const MEMBER_FRAMES = ['none', 'brass', 'silver', 'emerald'] as const;
export const MemberAppearanceSchema = z.strictObject({
  theme: z.enum(MEMBER_THEMES),
  frame: z.enum(MEMBER_FRAMES),
  supporterTitle: z.boolean(),
});
export type MemberAppearance = z.infer<typeof MemberAppearanceSchema>;
export const MembershipStateSchema = z.strictObject({
  active: z.boolean(),
  status: z.enum(['none', 'active', 'grace', 'expired', 'revoked', 'hold']),
  store: z.enum(['apple', 'google', 'local']).nullable(),
  paidUntil: z.string().nullable(),
  graceUntil: z.string().nullable(),
  autoRenew: z.boolean(),
  paidMonths: z.number().int().nonnegative(),
  badge: z.enum(['bronze', 'silver', 'gold', 'platinum']).nullable(),
  appearance: MemberAppearanceSchema,
  salesEnabled: z.boolean(),
  grants: z.array(z.strictObject({ period: z.string(), at: z.string(), refunded: z.boolean() })),
});
export type MembershipState = z.infer<typeof MembershipStateSchema>;
export const MembershipClaimSchema = z.strictObject({
  store: z.enum(['apple', 'google']),
  token: z.string().min(1).max(32768),
  productId: z.literal(MEMBERSHIP_PRODUCT),
});
export const MembershipFixtureSchema = z.strictObject({
  scenario: z.enum(['active', 'renew', 'cancel', 'grace', 'expired', 'refund', 'hold', 'none']),
  months: z.number().int().min(1).max(24).default(1),
});
export * from './membership-rules.js';
export const DEFAULT_MEMBER_APPEARANCE: MemberAppearance = {
  theme: 'classic',
  frame: 'none',
  supporterTitle: false,
};

export const MembershipResponseSchema = z.strictObject({
  membership: MembershipStateSchema,
  account: z.string(),
  stores: z.array(z.enum(['apple', 'google'])),
  items: z.strictObject({
    reroll: z.number().int().nonnegative(),
    scout: z.number().int().nonnegative(),
    boost: z.number().int().nonnegative(),
  }),
});
export type MembershipResponse = z.infer<typeof MembershipResponseSchema>;

export const GoogleMemberPushEnvelopeSchema = z.object({
  message: z.object({ messageId: z.string().min(1).max(256), data: z.string().min(1).max(32768) }),
});
export const GoogleMemberPushEventSchema = z.object({
  packageName: z.string(),
  subscriptionNotification: z
    .object({ purchaseToken: z.string().min(1).max(16384), notificationType: z.number().int() })
    .optional(),
  voidedPurchaseNotification: z
    .object({
      purchaseToken: z.string().min(1).max(16384),
      orderId: z.string().min(1).max(256),
      productType: z.number().int(),
    })
    .optional(),
  testNotification: z.object({}).optional(),
});
