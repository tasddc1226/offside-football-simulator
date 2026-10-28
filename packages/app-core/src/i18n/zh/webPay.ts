import type { Translation } from '../core';
import type { WebPayMsgs } from '../ko/webPay';

export const webPay: Translation<WebPayMsgs> = {
  title: '在網頁購買',
  sub: '可使用信用卡・PayPal・各國付款方式購買，會立即存入這個球隊老闆帳號。',
  pack: (p) =>
    `${{ reroll: '重抽券', boost: '潛力強化券', scout: '高級球探券', rename: '球員改名券' }[p.item] ?? p.item} ${p.n} 張`,
  price: (p) => `₩${p.won} 起`,
  priceNote: '付款畫面會以你所在國家的幣別、含稅價格顯示。',
  opening: '正在前往付款畫面…',
  startFail: '無法開啟付款畫面，請稍後再試。',
  confirming: '正在確認付款…',
  done: '付款完成，道具已存入。',
  pending: '付款確認後，道具會自動存入。如果沒有付款，不用理會即可。',
  canceled: '此筆付款已退款，已收回道具。',
  refund:
    '若未使用已收到的道具，可在付款日起 7 天內申請退款。已使用的道具無法退款。聯絡我們：contact@offside-lab.com',
};
