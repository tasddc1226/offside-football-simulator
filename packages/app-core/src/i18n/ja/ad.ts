import type { Translation } from '../core';
import type { AdMsgs } from '../ko/ad';

export const ad: Translation<AdMsgs> = {
  title: '広告削除',
  body: '記録室・お知らせ・レジェンドの下部の広告をずっとオフにします。同じストアアカウントのほかの端末でも購入を復元できます。',
  owned: '広告削除を購入済みです。ありがとうございます。',
  checking: 'ストアを確認中…',
  buyPrice: (p) => `広告削除 ${p.price}`,
  restore: '購入を復元',
  pending: '決済の承認を待っています。承認されると広告がオフになります。',
  done: '広告をオフにしました。ありがとうございます。',
  payFail: '決済できませんでした。しばらくしてからもう一度お試しください。',
  storeFail: 'ストアに接続できませんでした。しばらくしてからもう一度お試しください。',
  payStartFail: '決済を開始できませんでした。しばらくしてからもう一度お試しください。',
  restored: '購入を復元し、広告をオフにしました。',
  noPurchase: 'このストアアカウントには広告削除の購入記録がありません。',
  restoreFail: '復元できませんでした。しばらくしてからもう一度お試しください。',
  rewardedUnavailable: '今は広告を読み込めません。しばらくしてからもう一度お試しください。',
  rewardedWatch: '広告を最後まで見ると評価を見られます。',
  adRerollBtn: (p) => `広告を見て引き直す(今日あと${p.n}回)`,
  adRerollFreeBtn: (p) => `候補を引き直す(今日あと${p.n}回)`,
  adRerollWatch: '広告を最後まで見ると候補を引き直せます。',
  adRerollDone: (p) => `候補を引き直しました。今日はあと${p.n}回引き直せます。`,
};
