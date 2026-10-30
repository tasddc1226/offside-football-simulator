import type { Translation } from '../core';
import type { WebPayMsgs } from '../ko/webPay';

export const webPay: Translation<WebPayMsgs> = {
  title: 'ウェブで購入',
  sub: 'カード・PayPal・各国の決済手段で購入できます。このオーナーアカウントにすぐ入ります。',
  pack: (p) =>
    `${{ reroll: 'リロール券', boost: 'ポテンシャル強化券', scout: 'プレミアムスカウト券', rename: '選手名変更券' }[p.item] ?? p.item}${p.n}枚`,
  price: (p) => `₩${p.won}から`,
  priceNote: '決済画面ではお住まいの国の通貨・税込みの価格で表示されます。',
  opening: '決済画面に移動しています…',
  startFail: '決済画面を開けませんでした。しばらくしてからもう一度お試しください。',
  confirming: '決済を確認しています…',
  done: '決済が完了し、アイテムが入りました。',
  pending: '決済が確認されるとアイテムが自動で入ります。決済していない場合はそのままで大丈夫です。',
  canceled: '返金された決済のため、アイテムを回収しました。',
  refund:
    '受け取ったアイテムを使っていなければ、決済日から7日以内に返金を申請できます。使ったアイテムは返金できません。お問い合わせ: contact@offside-lab.com',
};
