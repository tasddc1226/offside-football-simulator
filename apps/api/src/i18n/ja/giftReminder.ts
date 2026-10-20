import { HOME_GIFT } from '@offside/contracts/cup';

export const giftReminderText = {
  title: 'オーナーギフトが残っています',
  body: `ホームでポテンシャル強化券${HOME_GIFT.boost}枚とプレミアムスカウト券${HOME_GIFT.scout}枚を受け取りましょう。`,
} as const;
