import type { Translation } from '@offside/contracts/i18n';
import type { GLegacyMsgs } from '../ko/gLegacy';

export const gLegacy: Translation<GLegacyMsgs> = {
  academy: 'ユースアカデミー',
  charity: 'チャリティー財団',
  club: '最初のプロクラブ支援',
  tier1: '銅',
  tier2: '銀',
  tier3: '金',
  tier4: 'レジェンド',
  settled: (p) =>
    `引退後のレガシー：残りの資金${p.money}を${p.kind}に使いました（${p.tier}ランク）。`,
};
