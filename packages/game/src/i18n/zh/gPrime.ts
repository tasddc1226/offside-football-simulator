import type { Translation } from '@offside/contracts/i18n';
import type { GPrimeMsgs } from '../ko/gPrime';

export const gPrime: Translation<GPrimeMsgs> = {
  success: (p) =>
    `全盛期延長成功。${p.peak}歲賽季結束後能力值才會開始下降${p.ad ? '（廣告）' : `（${p.cost}）`}。`,
  great: (p) =>
    `全盛期延長大成功！一次延長兩年，${p.peak}歲賽季結束後能力值才會開始下降${p.ad ? '（廣告）' : `（${p.cost}）`}。`,
  fail: (p) => `全盛期延長失敗${p.ad ? '（廣告）' : `（${p.cost}）`}。下次成功機率會提高。`,
};
