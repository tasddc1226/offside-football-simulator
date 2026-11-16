import type { Translation } from '@offside/contracts/i18n';
import type { GPrimeMsgs } from '../ko/gPrime';

export const gPrime: Translation<GPrimeMsgs> = {
  success: (p) =>
    `全盛期の延長に成功しました。${p.peak}歳のシーズンが終わってから能力値が下がり始めます${p.ad ? '（広告）' : `（${p.cost}）`}。`,
  great: (p) =>
    `全盛期延長、大成功！2年まとめて延び、${p.peak}歳のシーズンが終わってから能力値が下がり始めます${p.ad ? '（広告）' : `（${p.cost}）`}。`,
  fail: (p) =>
    `全盛期の延長に失敗しました${p.ad ? '（広告）' : `（${p.cost}）`}。次の成功確率が上がります。`,
};
