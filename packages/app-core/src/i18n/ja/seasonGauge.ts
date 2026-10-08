import type { Translation } from '../core';
import type { SeasonGaugeMsgs } from '../ko/seasonGauge';

export const seasonGauge: Translation<SeasonGaugeMsgs> = {
  title: (p) => `${p.season} 進行度`,
  aria: (p) => `${p.season} 進行度 ${p.pct}%`,
  filled: (p) => `完走キャリア ${p.count} / ${p.target}`,
  owners: (p) => `参加オーナー ${p.n}人`,
  howTo:
    '最後までプレーしたキャリア(35歳以上で引退)がゲージを満たします。90%で締め切り日が決まります。',
  window: (p) => `早くて${p.min} 0:00、遅くとも${p.max} 0:00(KST)に終わります。`,
  endsIn: (p) => `シーズン終了まで ${p.left}`,
  endsAt: (p) => `${p.date} 0:00(KST)締め切り · 締め切り後の引退は今シーズンの順位に入りません。`,
  ended: 'シーズンが終わりました。結果を集計しています。',
  date: (p) => `${p.m}月${p.d}日`,
  days: (p) => `${p.d}日${p.h}時間`,
  hours: (p) => `${p.h}時間${p.m}分`,
  minutes: (p) => `${p.m}分`,
};
