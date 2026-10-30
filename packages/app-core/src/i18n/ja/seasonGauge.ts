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
  why: (p) => `${p.n}人で一緒に進めています。参加者が増えると目標も大きくなります。`,
  openLabel: (p) => `${p.aria}。シーズン進行度の説明を見る`,
  infoTitle: 'シーズン進行度',
  infoWhatHead: 'サービスシーズン',
  infoWhat:
    '記録室の順位と記録はサービスシーズンごとに集計されます。シーズンの長さは日付で決めず、みんなで進めるこのゲージで決まります。',
  infoFillHead: 'ゲージが進む条件',
  infoFill: (p) =>
    `${p.age}歳以上までプレーして引退したキャリアでゲージが進みます。1人が1日に加えられるキャリアは${p.cap}件までです。目標は引退までプレーしたキャリアが1件以上ある参加者1人あたり${p.per}件なので、参加者が増えると目標も大きくなります。`,
  infoEndHead: '締め切り',
  infoEnd: (p) =>
    `ゲージが${p.lock}%に達すると終了時刻が決まり、残り時間が表示されます。1シーズンは最短${p.min}日、最長${p.max}日です。オフサイドカップが終わっていなければ、最後の試合の翌日0時（韓国時間）まで続きます。リーグは終了の前日まで行い、終了時に精算します。終了時刻にすぐ次のシーズンが始まります。`,
  infoCareerHead: '進行中のキャリア',
  infoCareer:
    'シーズンが終わっても、進行中のキャリアはそのまま続けられます。選手は最初のシーズン記録がサーバーに送られたシーズンに属し、次のシーズンが始まっても変わりません。シーズン総括の順位バッジと完走記録には、締め切り前に引退した選手だけが入ります。',
  infoWhereHead: '報酬と実績',
  infoWhere:
    'シーズン総括と記録バッジはマイクラブの名誉の殿堂で、実績はマイチームの実績メニューで確認できます。新しいシーズンではオーナーチームを新しく作り、選手カード・クラブ資金・アイテムはそのまま引き継がれます。',
  infoClose: '閉じる',
};
