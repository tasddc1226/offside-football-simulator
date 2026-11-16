import type { Translation } from '@offside/contracts/i18n';
import type { GLegacyMsgs } from '../ko/gLegacy';

export const gLegacy: Translation<GLegacyMsgs> = {
  academy: '青訓學院',
  charity: '慈善基金會',
  club: '贊助第一支職業球隊',
  tier1: '銅',
  tier2: '銀',
  tier3: '金',
  tier4: '傳奇',
  settled: (p) => `退休遺產：把剩下的資金${p.money}用於${p.kind}（${p.tier}等級）。`,
};
