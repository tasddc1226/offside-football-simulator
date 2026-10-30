import type { Translation } from '@offside/contracts/i18n';
import type { GDexMsgs } from '../ko/gDex';

export const gDex: Translation<GDexMsgs> = {
  factorClub: '所屬球隊實力',
  factorLeague: '聯賽水準',
  factorTrust: '總教練信任',
  factorMorale: '士氣',
  factorFame: '名聲',
  factorCond: '狀態',
  factorAge: '年齡',
  factorInjury: '傷勢程度',
  factorContract: '剩餘合約期',
  factorOvr: '綜合能力值（OVR）',
  factorTrait: (p) => `特性「${p.name}」`,
  labelVaries: '（依情況變化的選項）',
};
