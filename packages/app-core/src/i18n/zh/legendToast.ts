import type { Translation } from '../core';
import type { LegendToastMsgs } from '../ko/legendToast';

export const legendToast: Translation<LegendToastMsgs> = {
  detailFailed: '無法載入詳細紀錄。',
  nameBlocked: '含有連結或不雅字詞的名字無法公開，只能以匿名登上名人堂。',
  namePublished: '已在名人堂公開名字。',
  nameAnon: '已在名人堂改為匿名。',
};
