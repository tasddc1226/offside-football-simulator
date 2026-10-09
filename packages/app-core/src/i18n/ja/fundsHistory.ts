import type { Translation } from '../core';
import type { FundsHistoryMsgs } from '../ko/fundsHistory';

export const fundsHistory: Translation<FundsHistoryMsgs> = {
  eyebrow: 'Club funds',
  title: 'クラブ資金の履歴',
  balance: '現在のクラブ資金',
  income: '入ってきた資金',
  spending: '出ていった資金',
  released: '放出',
  sold: '売却',
  fees: (p) => `手数料 ${p.fee} 差引`,
  bought: '獲得',
  spent: 'クラブ資金で購入',
  log: '履歴',
  empty: 'まだクラブ資金の動きがありません。育てた選手を放出するか移籍市場で売ると資金が入ります。',
  more: 'もっと見る',
  loadFail: '履歴を読み込めませんでした。',
  retry: 'もう一度',
  date: (p) => `${p.m}月${p.d}日`,
  openAria: 'クラブ資金の履歴を見る',
};
