import type { Translation } from '@offside/contracts/i18n';
import type { GDexMsgs } from '../ko/gDex';

export const gDex: Translation<GDexMsgs> = {
  factorClub: '所属チームの戦力',
  factorLeague: 'リーグのレベル',
  factorTrust: '監督の信頼',
  factorMorale: '士気',
  factorFame: '名声',
  factorCond: 'コンディション',
  factorAge: '年齢',
  factorInjury: 'ケガの程度',
  factorContract: '残りの契約期間',
  factorOvr: '総合能力値（OVR）',
  factorTrait: (p) => `特性「${p.name}」`,
  labelVaries: '（状況によって変わる選択肢）',
};
