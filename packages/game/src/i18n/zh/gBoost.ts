import type { Translation } from '@offside/contracts/i18n';
import type { GBoostMsgs } from '../ko/gBoost';

export const gBoost: Translation<GBoostMsgs> = {
  success: (p) => `潛力強化成功，提升至第${p.lv}階（${p.cost}）。`,
  fail: (p) => `潛力強化失敗（${p.cost}）。下次成功率會提高。`,
  successAd: (p) => `潛力強化成功，提升至第${p.lv}階（廣告）。`,
  failAd: '潛力強化失敗（廣告）。下次成功率會提高。',
  successClub: (p) => `潛力強化成功，提升至第${p.lv}階（俱樂部資金）。`,
  failClub: '潛力強化失敗（俱樂部資金）。下次成功率會提高。',
  successTicket: (p) => `潛力強化成功，提升至第${p.lv}階（強化券）。`,
  failTicket: '潛力強化失敗（強化券）。下次成功率會提高。',
  successSure: (p) => `以確定強化提升潛力，現在是第${p.lv}階（俱樂部資金）。`,
  great: (p) => `潛力強化大成功，一次提升兩階，現在是第${p.lv}階。`,
  greatCost: (p) => `潛力強化大成功，一次提升兩階，現在是第${p.lv}階（${p.cost}）。`,
};
