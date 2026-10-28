import type { Translation } from '../core';
import type { IapMsgs } from '../ko/iap';

export const iap: Translation<IapMsgs> = {
  packsTitle: '在商店購買',
  rerollPack: (p) => `重抽券${p.n}張`,
  boostPack: (p) => `潛力強化券${p.n}張`,
  renamePack: (p) => `球員改名券${p.n}張`,
  busy: '付款中…',
  loading: '正在確認商店…',
  storeFail: '無法連接商店，請稍後再試。',
  payStartFail: '無法開始付款，請稍後再試。',
  payFail: '付款失敗，請稍後再試。',
  pending: '正在等待付款核准。核准後會自動領取。',
  rerollDone: (p) => `已領取重抽券。目前有${p.n}張。`,
  boostDone: (p) => `已領取潛力強化券。目前有${p.n}張。`,
  renameDone: (p) => `已領取球員改名券。目前有${p.n}張。`,
  claimFail: '付款已完成，但領取時發生問題。請按「重新確認領取」，或在下次開啟 App 時領取。',
  loadFail: '無法載入商品。',
  retry: '重新確認',
  loginHint: '登入後即可在商店購買。',
  claimLeft: '有已付款但尚未領取的商品。',
  claimRetry: '重新確認領取',
  claimNone: '沒有尚未領取的付款。',
  rerollNote: '重抽券用於建立新球員時重抽 3 名候選。付款以商店帳號進行，商品會發送到這個老闆帳號。',
  boostBuyLead: '使用強化券不必看廣告，可立即挑戰且不限次數。',
  boostNote: (p) =>
    `1 張強化券可挑戰 1 次，在本賽季挑戰後或資金不足時都能使用。與廣告、俱樂部資金的追加挑戰不同，沒有次數上限。目前成功機率為${p.chance}%（失敗後下次機率會提高）。`,
  shopTitle: '潛力強化券商店',
  shopSub: '用於球員分頁的潛力強化',
  shopSubHave: (p) => `持有 ${p.n}張 · 用於球員分頁的潛力強化`,
  shopNote:
    '1 張強化券可挑戰 1 次，在本賽季挑戰後或資金不足時都能使用。與廣告、俱樂部資金的追加挑戰不同，沒有次數上限，成功機率相同。付款以商店帳號進行，商品會發送到這個老闆帳號。',
  shopWeb: '強化券可在 App 中購買。',
};
