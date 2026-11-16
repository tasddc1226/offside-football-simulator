import type { Translation } from '@offside/contracts/i18n';
import type { GAuctionMsgs } from '../ko/gAuction';

export const gAuction: Translation<GAuctionMsgs> = {
  watch: '高級腕時計',
  car: 'クラシックカー',
  art: '美術品',
  trophy: 'トロフィーレプリカ',
  wine: 'ビンテージワイン',
  shirt: '記念ユニフォーム',
  g1: '一般',
  g2: '高級',
  g3: '名品',
  g4: '伝説',
  bought: (p) =>
    `オークションで${p.item}を${p.cost}で落札しました。箱を開けると${p.grade}等級でした。`,
  dupe: (p) =>
    `オークションで${p.item}を${p.cost}で落札しました。すでに持っている${p.grade}等級だったので${p.refund}で売りました。`,
  complete: (p) => `${p.item}の4等級をすべて集め、コレクション棚が一段埋まりました。`,
};
