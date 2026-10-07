import type { Translation } from '@offside/contracts/i18n';
import type { GPeekMsgs } from '../ko/gPeek';

export const gPeek: Translation<GPeekMsgs> = {
  paid: (p) => `スカウトに${p.cost}を払い、今シーズンのポテンシャル評価を受けた。`,
};
