import type { Translation } from '@offside/contracts/i18n';
import type { GAuctionMsgs } from '../ko/gAuction';

export const gAuction: Translation<GAuctionMsgs> = {
  watch: '名錶',
  car: '經典跑車',
  art: '藝術品',
  trophy: '獎盃複製品',
  wine: '陳年葡萄酒',
  shirt: '紀念球衣',
  g1: '一般',
  g2: '高級',
  g3: '名品',
  g4: '傳說',
  bought: (p) => `在拍賣會上以${p.cost}拍下了${p.item}。打開盒子一看，是${p.grade}等級。`,
  dupe: (p) =>
    `在拍賣會上以${p.cost}拍下了${p.item}。這是已經擁有的${p.grade}等級，所以以${p.refund}轉賣了。`,
  complete: (p) => `集齊了${p.item}的四個等級，收藏櫃填滿了一格。`,
};
