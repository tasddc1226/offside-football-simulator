import type { Translation } from '../core';
import type { CareerCleanupMsgs } from '../ko/careerCleanup';

export const careerCleanup: Translation<CareerCleanupMsgs> = {
  title: '過去のキャリア整理',
  body: '新しい選手でやり直したときに続けなかったキャリアを整理します。引退した選手の記録、カード、殿堂はそのまま残ります。',
  find: '整理するキャリアを探す',
  finding: '探しています。',
  none: '整理するキャリアはありません。',
  found: (p) => `1日以上続けていないキャリアが${p.n}件あります。`,
  clear: (p) => `${p.n}件を整理する`,
  clearing: '整理しています。',
  confirmTitle: '過去のキャリア整理',
  confirm: (p) =>
    `キャリア${p.n}件を整理しますか？この端末でプレイ中のキャリアは除きます。整理したキャリアもバックアップから続けると整理が解除されます。`,
  cancel: 'キャンセル',
  ok: '整理する',
  done: (p) => `キャリア${p.n}件を整理しました。`,
  error: '読み込めませんでした。少し待ってからもう一度お試しください。',
  clearError: (p) =>
    `キャリア${p.n}件まで整理して止まりました。少し待ってからもう一度お試しください。`,
};
