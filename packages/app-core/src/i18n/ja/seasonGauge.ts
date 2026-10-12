import type { Translation } from '../core';
import type { SeasonGaugeMsgs } from '../ko/seasonGauge';

export const seasonGauge: Translation<SeasonGaugeMsgs> = {
  title: (p) => `${p.season} 進行度`,
  aria: (p) => `${p.season} 進行度 ${p.pct}%`,
  endsIn: (p) => `シーズン終了まで ${p.left}`,
  ended: 'シーズンが終わりました。結果を集計しています。',
  days: (p) => `${p.d}日${p.h}時間`,
  hours: (p) => `${p.h}時間${p.m}分`,
  minutes: (p) => `${p.m}分`,
  date: (p) => `${p.m}月${p.d}日(${'日月火水木金土'[p.w]})`,
  endsOn: (p) => `${p.date}まで開催`,
  endsBy: (p) => `遅くとも${p.date}まで開催`,
  endsBetween: (p) => `早ければ${p.from}、遅くとも${p.to}まで開催`,
};
