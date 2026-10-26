import type { Translation } from '@offside/contracts/i18n';
import type { GCareMsgs } from '../ko/gCare';

export const gCare: Translation<GCareMsgs> = {
  bought: (p) =>
    `コンディション管理プログラムを始めました。今シーズン終了時の能力低下が${p.cut}%小さくなります（${p.cost}）。`,
};
