import type { Translation } from '@offside/contracts/i18n';
import type { GCareMsgs } from '../ko/gCare';

export const gCare: Translation<GCareMsgs> = {
  bought: (p) => `開始身體管理計畫。本賽季結束時的能力值下滑減少${p.cut}%（${p.cost}）。`,
};
