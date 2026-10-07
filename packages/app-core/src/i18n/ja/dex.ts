import type { Translation } from '../core';
import type { DexMsgs } from '../ko/dex';

export const dex: Translation<DexMsgs> = {
  title: '確率図鑑',
  intro: '選手の状態によって成功確率が変わります。ありうる範囲と影響する要因を表示します。',
  rulesTitle: '共通ルール',
  calculating: '確率を計算中…',
  events: 'イベント',
  foundCount: (p) => `発見 ${p.n}/${p.total}`,
  groupLabel: '分類',
  filterAll: 'すべて',
  foundMark: '発見',
  lockedStory: (p) => `まだ出会っていないストーリーイベント · ${p.stage}段階`,
  lockedSpecial: 'まだ出会っていない特別イベント',
  dependsOnPast: '前の段階での選択によって確率が変わります。',
  noteWeb:
    '▲は値が大きいほど成功確率が上がり、▼は下がります。範囲は選手の状態によって出うる最低〜最高の確率です。',
  noteApp:
    '▲は値が大きいほど成功確率が上がり、▼は下がります。範囲はありうるすべての選手の状態で出うる最低〜最高です。',
  oddsSafe: '安全',
  oddsSure: '確定',
  oddsVaries: '状況次第',
  oddsMinigame: (p) => `ワンタッチ · ゾーン ${p.range}%`,
  ruleRateTerm: 'イベントが起きる確率',
  ruleRate: (p) =>
    `フェーズごとにプレシーズン${p.pre}、前半戦・後半戦${p.season}。ストーリーの次の段階は、予定された時期に別途やってきます。`,
  ruleSameTerm: '同じイベント',
  ruleSame: (p) =>
    `一度出たイベントは少なくとも${p.n}フェーズは再び出ず、見た回数が多いほど出にくくなります（重み 1/(1+見た回数)）。`,
  ruleRollTerm: '成功判定',
  ruleRoll:
    '選択画面に出る%が実際の判定確率です。0〜100のランダムな数がそれより小さければ成功です。隠れた補正はなく、広告・課金・アカウントに関係なく、すべてのユーザーに同じルールです。',
  ruleMiniTerm: 'ワンタッチミニゲーム',
  ruleMini:
    'PK・1対1・PK戦のように試合シーンがある選択は、確率ではなくタイミングで決まります。ゲージ上を行き来する針を緑のゾーンで止めれば成功です。3秒以内に押さないと失敗です。ゾーンの幅は能力値で決まり、図鑑にはゲージに対するゾーンの幅を記載しています。動きを減らす設定がオンのときは、表示された確率で判定します。',
  ruleSafeTerm: '安全な選択',
  ruleSafe: (p) =>
    `判定なしで確定しますが、良い効果が${p.span}に減り、${p.twist}の確率で代償を払います（${p.cost}のいずれか）。`,
  ruleResultTerm: '結果の数値',
  ruleResult: (p) => `それ以外の効果は、表示された大きさの${p.span}の間で決まります。`,
  ruleTwistTerm: '思わぬ展開',
  ruleTwist: (p) =>
    `代償がなかった場合、${p.twist}の確率で能力値がひとつ変わります。上がる確率は成功・確定で${p.ok}、失敗で${p.fail}、安全な選択で${p.safe}です。上がると+1〜2、下がると−1です。`,
};
