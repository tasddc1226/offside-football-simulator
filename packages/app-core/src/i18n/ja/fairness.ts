import type { Translation } from '../core';
import type { FairnessMsgs } from '../ko/fairness';

export const fairness: Translation<FairnessMsgs> = {
  title: '確率と公正さ',
  intro:
    'すべてのユーザーに同じルールと同じ確率を使います。下の数字はゲームのコードの値からそのまま計算しています。',
  promiseSameTerm: '同じルール',
  promiseSame: '広告の視聴、広告削除の購入、アカウント連携、言語設定は確率と結果に影響しません。',
  promiseDeviceTerm: '端末で判定',
  promiseDevice:
    'キャリアの判定はすべてこの端末で行われます。サーバーは結果を決めず、記録を受け取るだけです。',
  promiseShownTerm: '表示された確率が実際の確率',
  promiseShown:
    '選択肢に表示されるパーセントが実際の成功確率です。タイミングゲージの選択肢だけは針を止めた位置で判定します。',
  promiseVersionTerm: '調整はバージョンで',
  promiseVersion:
    '運営中に数値を変えるときは、すべてのユーザーに同じ値をバージョン付きで適用します。進行中のキャリアは次のシーズンから変わります。',
  potTitle: 'ポテンシャルランクの確率',
  potNote:
    '新しい選手の実際のポテンシャルはこの確率で決まります。広告でランクの範囲を見ても結果は変わりません。',
  gradeHead: 'ランク',
  colSeason: 'シーズン中に開始',
  colPre: 'プレシーズンに開始',
  atLeastOne: (p) =>
    `候補3人のうち${p.grade}ランクが1人以上出る確率は、シーズン中${p.season}、プレシーズン${p.pre}です。`,
  boostTitle: 'ポテンシャル強化の確率',
  boostLv: (p) => `+${p.lv}段階`,
  boostNote: (p) =>
    `同じ段階で失敗するたびに、次の挑戦の確率が${p.pity}ずつ上がります。広告で挑戦しても確率は同じです。`,
  hiddenTitle: '隠しているものと理由',
  hiddenPotTerm: '実際のポテンシャル',
  hiddenPot: '引退するときに公開します。スカウト評価は実際の値と少し違うことがあります。',
  hiddenBloomTerm: '遅咲きの選手',
  hiddenBloom:
    '実際のポテンシャルは25歳まで少しずつ上下し、21歳と24歳の再評価で反映されます。すべての選手に同じルールです。',
  hiddenStoryTerm: 'ストーリー・特別イベント',
  hiddenStory:
    'ネタバレを防ぐため、一度経験すると図鑑に表示されます。確率のルールは他のイベントと同じです。',
  historyTitle: 'バランス変更履歴',
  historyLoading: '履歴を読み込んでいます…',
  historyError: '履歴を読み込めませんでした。',
  historyEmpty: 'まだ変更はありません。すべてのキャリアが基本バランスで進みます。',
  historyVersion: (p) => `バージョン${p.v} · ${p.day}`,
  historyActive: '現在適用中',
  historySame: '変わった項目はありません。',
  historyNote: '項目名の横は、直前のバージョンの値から変わった値です。日付は韓国時間です。',
  version: (p) =>
    p.v
      ? `いま新しいキャリアにはバランスバージョン${p.v}が適用されます。`
      : 'いま新しいキャリアには基本バランス(バージョン0)が適用されます。',
};
