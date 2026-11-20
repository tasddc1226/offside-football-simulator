import type { Translation } from '@offside/contracts/i18n';
import type { gLoanText } from '../ko/gLoan';
export const gLoan: Translation<typeof gLoanText> = {
  returnTitle: 'レンタル復帰の面談',
  returnRecord: (p: { club: string; apps: number }) =>
    `${p.club}で${p.apps}試合に出場し、戻ってきました。監督が尋ねます。「前半戦が終わったら、どの数字を一緒に見ようか？」`,
  returnPrompt: '監督が前半戦の目標を尋ねます。',
  pickStarts: 'リーグ戦で先発5試合を約束する',
  pickMinutes: 'リーグ戦で出場450分を約束する',
  promiseStarts: '監督が前半戦終了後の面談日を書き込みました。目標はリーグ戦先発5試合です。',
  promiseMinutes: '監督が面談日を書き込みました。途中出場も450分に含まれます。',
  startsTitle: '前半戦の面談・先発',
  minutesTitle: '前半戦の面談・出場時間',
  startsReport: (p: { actual: number }) =>
    `監督が前半戦の先発表を広げました。約束は5試合、実際の先発は${p.actual}試合です。`,
  minutesReport: (p: { actual: number }) =>
    `監督が前半戦の出場記録を開きました。約束は450分、実際の出場時間は${p.actual}分です。`,
  roleLabel: '後半戦の役割について話す',
  trainingLabel: '次の練習で改善する点を聞く',
  roleMet: '「約束を果たしたな」監督が戦術ボードをこちらに向けました。',
  roleMiss: '監督が空いた枠を指しました。「まだポジションは約束できない」',
  trainMet: '目標を達成した試合を見返し、次の練習課題を決めました。',
  trainMiss: '目標には届きませんでした。コーチと次の練習で試すことを決めました。',
  title: '出場機会の面談',
  text: '出場時間がなかなか増えません。代理人が来シーズンのレンタル移籍の話を切り出します。',
  askLabel: 'クラブにレンタル移籍を申し出る',
  askResult: 'クラブが申し出を受け入れました。シーズンが終わったらレンタル先を探してくれます。',
  stayLabel: '残ってレギュラー争いをする',
  stayResult: '練習場に誰よりも早く来て、誰よりも遅く帰りました。監督が注目し始めました。',
  stayFail: '歯を食いしばって耐えましたが、次の試合のメンバーにも名前はありませんでした。',
};
