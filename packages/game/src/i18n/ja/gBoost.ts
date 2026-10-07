import type { Translation } from '@offside/contracts/i18n';
import type { GBoostMsgs } from '../ko/gBoost';

export const gBoost: Translation<GBoostMsgs> = {
  success: (p) => `ポテンシャル強化に成功。${p.lv}段階になりました（${p.cost}）。`,
  fail: (p) => `ポテンシャル強化に失敗（${p.cost}）。次回の成功率が上がります。`,
  successAd: (p) => `ポテンシャル強化に成功。${p.lv}段階になりました（広告）。`,
  failAd: 'ポテンシャル強化に失敗（広告）。次回の成功率が上がります。',
};
