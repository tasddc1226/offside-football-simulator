import type { Translation } from '../core';
import type { GameLegacyMsgs } from '../ko/gameLegacy';

export const gameLegacy: Translation<GameLegacyMsgs> = {
  title: '引退後のレガシー',
  linePick:
    '引退するとき、残りの資金で何を残すか選んでおきましょう。残りの資金が多いほどランクが上がります。',
  lineBelow: (p) => `銅ランクまであと${p.need}必要です。`,
  lineTierNext: (p) =>
    `今引退すると${p.kind}・${p.tier}ランクです。${p.next}ランクまであと${p.need}です。`,
  lineTierMax: (p) => `今引退すると${p.kind}・${p.tier}ランクです。最高ランクです。`,
  ladderLabel: 'ランク基準（残りの資金）',
  note: '引退するときに残りの資金をすべて使い、種類とランクが殿堂に残ります。金額は表示されません。金ランクから称号がもらえます。',
  retireLine: (p) => `引退後のレガシー：${p.kind}・${p.tier}ランクで残ります。`,
  retireLineBelow: (p) => `レガシー（${p.kind}）は銅ランクに届かず、残りません。`,
  creditTitle: '引退後のレガシー',
  creditAcademy: '選手の名前を冠したアカデミーで、次の世代がボールを蹴り始めました。',
  creditCharity: '財団はピッチの外でも選手の名前を受け継いでいきます。',
  creditClub: '初めてプロ契約を結んだクラブに、受けた恩を返しました。',
};
