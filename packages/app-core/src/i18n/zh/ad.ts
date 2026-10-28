import type { Translation } from '../core';
import type { AdMsgs } from '../ko/ad';

export const ad: Translation<AdMsgs> = {
  title: '移除廣告',
  body: '永久關閉紀錄室・消息・傳奇頁面底部的廣告，以及退役時的全螢幕廣告。重新抽候選・查看潛力・賽季評價・潛力強化的獎勵廣告也不用看，直接領取。機率與次數上限不變，也不包含重抽券・球探券・強化券。同一個商店帳號的其他裝置也能恢復購買。',
  owned: '你已購買移除廣告，謝謝支持！',
  checking: '正在確認商店…',
  buyPrice: (p) => `移除廣告 ${p.price}`,
  restore: '恢復購買',
  pending: '正在等待付款核准。核准後廣告就會關閉。',
  done: '廣告已關閉，謝謝支持！',
  payFail: '付款失敗，請稍後再試。',
  storeFail: '無法連線到商店，請稍後再試。',
  payStartFail: '無法開始付款，請稍後再試。',
  restored: '已恢復購買並關閉廣告。',
  noPurchase: '這個商店帳號沒有移除廣告的購買紀錄。',
  restoreFail: '恢復失敗，請稍後再試。',
  rewardedUnavailable: '目前無法載入廣告，請稍後再試。',
  rewardedWatch: '看完廣告就能查看評價。',
  adRerollBtn: (p) => `看廣告重新抽（今天剩 ${p.n} 次）`,
  adRerollFreeBtn: (p) => `重新抽候選（今天剩 ${p.n} 次）`,
  adRerollShort: '重新抽',
  adRerollBadge: (p) => (p.ad ? `廣告・${p.n} 次` : `${p.n} 次`),
  adRerollConfirm: (p) =>
    `要重新抽 3 名候選嗎？目前的候選與已確認的潛力範圍都會消失，今天還剩 ${p.n} 次。`,
  adRerollWatch: '要看完廣告才能重新抽候選。',
  adRerollDone: (p) => `已重新抽候選。今天還能再抽 ${p.n} 次。`,
};
