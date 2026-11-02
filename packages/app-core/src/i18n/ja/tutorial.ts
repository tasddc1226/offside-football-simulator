import type { Translation } from '../core';
import type { TutorialMsgs } from '../ko/tutorial';

export const tutorial: Translation<TutorialMsgs> = {
  step: (p) => `${p.n} / ${p.total}`,
  skip: 'スキップ',
  next: '次へ',
  done: 'わかりました',
  tapHint: '光っている所をタップしてください',
  label: 'はじめてのキャリア案内',
  newTitle: '最初の選手を作りましょう',
  newBody: '高校3年から引退まで、ひとりの選手のキャリアを追います。ここをタップして始めます。',
  posTitle: 'ポジションを選びます',
  posBody: 'ポジションごとに大事な能力値と積み上がる記録が違います。',
  focusTitle: (p) => `主力能力値を${p.n}つ選びます`,
  focusBody: '選んだ組み合わせで選手タイプが決まり、最初の能力値もそちらに寄ります。',
  candidatesTitle: '候補を見ます',
  candidatesBody: '残りは初期設定のまま、このボタンで候補を見られます。',
  candsTitle: '候補カードをタップして選びます',
  candsBody:
    '3人は能力値の合計が同じで、配分が違います。タップすると開いて、そのまま選択されます。',
  startTitle: 'キャリアを始めます',
  startBody: '選んだ候補で最初のシーズンに入ります。',
  goTitle: 'シーズンを進めます',
  goBody:
    'タップするたびにシーズンが一段階ずつ進みます。トレーニングと自己投資は上のカードで変えます。',
  choiceTitle: 'イベントが来ました',
  choiceBody: 'ひとつ選びます。選んだ答えで能力値と人気が変わります。',
  seasonTitle: '最初のシーズンが終わりました',
  seasonBody: '1年の記録がここにまとまります。伸びた能力値は選手タブで見られます。',
  retireTitle: '引退すると殿堂入りします',
  retireBody:
    '記録・トロフィー・個人賞が増えるほどレジェンドスコアが上がります。キャリアを続けましょう。',
  replay: 'チュートリアルをもう一度見る',
};
