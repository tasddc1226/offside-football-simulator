import type { Translation } from '../core';
import type { StarterPackMsgs } from '../ko/starterPack';

export const starterPack: Translation<StarterPackMsgs> = {
  title: '初回購入パック',
  note: '1アカウントにつき1回だけ購入できます。決済はストアのアカウントで行い、このオーナーアカウントに届きます。',
  buy: (p) => `${p.price}で購入`,
  bought: '初回購入パックを受け取りました。',
  close: '閉じる',
};
