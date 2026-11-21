import type { Translation } from '../core';
import type { StarterPackMsgs } from '../ko/starterPack';

export const starterPack: Translation<StarterPackMsgs> = {
  title: '新手組合包',
  note: '每個帳號只能購買一次。付款以商店帳號進行，商品會發送到這個老闆帳號。',
  buy: (p) => `以 ${p.price} 購買`,
  bought: '已收到新手組合包。',
  close: '關閉',
};
