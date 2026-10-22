import type { Translation } from '../core';
import type { WebPayMsgs } from '../ko/webPay';

export const webPay: Translation<WebPayMsgs> = {
  title: 'ウェブで購入',
  sub: 'カード・簡単決済で購入できます。このオーナーアカウントにすぐ入ります。',
  pack: (p) =>
    `${{ reroll: 'リロール券', boost: 'ポテンシャル強化券', scout: 'プレミアムスカウト券', rename: '選手名変更券' }[p.item] ?? p.item}${p.n}枚`,
  price: (p) => `₩${p.won}`,
  pay: (p) => `₩${p.won}を支払う`,
  cancel: '閉じる',
  opening: '決済画面を開いています…',
  startFail: '決済画面を開けませんでした。しばらくしてからもう一度お試しください。',
  canceled: '決済をキャンセルしました。',
  failed: '決済できませんでした。決済手段を確認してもう一度お試しください。',
  confirming: '決済を確認しています…',
  done: '決済が完了し、アイテムが入りました。',
  claimFail:
    '決済は完了しました。受け取り中に問題が起きました。オーナー画面を開き直すと受け取れます。',
  refund:
    '受け取ったアイテムを使っていなければ、決済日から7日以内に返金を申請できます。使ったアイテムは返金できません。お問い合わせ: contact@offside-lab.com',
  shopWeb: '下の「ウェブで購入」で購入できます。',
};
