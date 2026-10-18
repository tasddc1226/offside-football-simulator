// T-11-388 홈 선물 안내 푸시(push/giftReminder.ts). 알림함 · 푸시는 한국어로 저장하고 push/text.ts가 요청 언어로 바꾼다.
import { HOME_GIFT } from '@offside/contracts/cup';

export const giftReminderText = {
  title: '구단주 선물이 남아 있어요',
  body: `홈에서 잠재력 강화권 ${HOME_GIFT.boost}장과 프리미엄 스카우트권 ${HOME_GIFT.scout}장을 받아요.`,
} as const;
