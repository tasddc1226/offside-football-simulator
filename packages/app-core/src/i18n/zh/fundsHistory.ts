import type { Translation } from '../core';
import type { FundsHistoryMsgs } from '../ko/fundsHistory';

export const fundsHistory: Translation<FundsHistoryMsgs> = {
  eyebrow: 'Club funds',
  title: '俱樂部資金紀錄',
  balance: '目前俱樂部資金',
  income: '收入',
  spending: '支出',
  released: '釋出',
  bonus: '退役獎勵金',
  sold: '出售',
  fees: (p) => `扣除手續費 ${p.fee}`,
  bought: '買入',
  spent: '以俱樂部資金購買',
  log: '紀錄',
  empty: '俱樂部資金還沒有任何變動。釋出培養的球員或在轉會市場出售，就會有資金進帳。',
  more: '查看更多',
  loadFail: '無法載入紀錄。',
  retry: '重試',
  date: (p) => `${p.m}月${p.d}日`,
  openAria: '查看俱樂部資金紀錄',
};
