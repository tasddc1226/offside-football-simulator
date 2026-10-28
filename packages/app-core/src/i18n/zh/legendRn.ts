import type { Translation } from '../core';
import type { LegendRnMsgs } from '../ko/legendRn';

export const legendRn: Translation<LegendRnMsgs> = {
  missKicker: '退休背號審核',
  missSeasons: (p: { club: string; seasons: number; need: number }) =>
    `在${p.club}效力了${p.seasons}個賽季。退休背號需要在同一支俱樂部效力${p.need}個賽季以上。`,
  pctBand: (p) => `${p.pct}%區間`,
  missScore: (p) =>
    `在${p.club}累積的貢獻分數為退休背號標準的${p.band}。超過標準才能獲得退休背號。`,
  missScoreClose: (p) =>
    `在${p.club}累積的貢獻分數離退休背號標準只差一點點。超過標準才能獲得退休背號。`,
  missScoreSeasons: (p) =>
    `在${p.club}累積的貢獻分數為退休背號標準的${p.band}，而且只效力${p.seasons}個賽季，也未達${p.need}個賽季的標準。`,
  missStatSeasons: '同一俱樂部賽季',
  missStatSeasonsVal: (p) => `${p.seasons} / ${p.need}個賽季`,
  missStatScore: '貢獻分數',
  missStatScoreVal: (p) => `標準的${p.band}`,
  missStatScoreClose: '略低於標準',
  missStatScoreOver: '達到標準',
  pending: '伺服器正在審核退休背號，稍後可以到名人堂確認。',
  lineNum: (p) => `${p.number}號`,
  lineNumAfter: '從此，',
  lineNameAfter: '的名字將永遠留存。',
  stats: (p) =>
    `${p.from}–${p.to} · ${p.seasons}個賽季 · ${p.apps}場 ${p.goals}球 ${p.assists}助攻`,
  foot: (p) => `${p.club} 退休背號 · 伺服器第${p.seq}個退休背號`,
  takenA: (p) => `${p.number}號已經以`,
  anonLegend: '匿名傳奇',
  takenB: '的名字留存，',
  takenC: '俱樂部將',
  takenD: '的名字刻上了榮譽牆。',
  anonA: '公開名字後，',
  anonSlot: (p) => `${p.club} ${p.number}號`,
  anonTail: '退休背號就會確定。',
  anonNote: '最先公開名字的球員會得到這個背號。',
  publish: '公開名字並領取退休背號',
  anonBlocked: '含有連結或不雅字詞的名字無法公開，因此無法領取這個退休背號。',
  alertTitle: (p) => `👑 ${p.name}，${p.number}號退休背號`,
  alertSub: (p) => `${p.club} · 伺服器第${p.seq}個退休背號`,
  alertLabel: (p) => `${p.name}，${p.number}號退休背號`,
  alertOpen: '查看',
  alertClose: '關閉通知',
  jerseyLabel: (p) => `${p.name} ${p.number}號退休背號球衣`,
  wallOfHonor: '憑藉在俱樂部的表現，獲得了「榮譽牆」稱號。',
};
