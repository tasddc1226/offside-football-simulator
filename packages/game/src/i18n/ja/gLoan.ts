import type { Translation } from '@offside/contracts/i18n';
import type { gLoanText } from '../ko/gLoan';
export const gLoan: Translation<typeof gLoanText> = {
  title: '出場機会の面談',
  text: '出場時間がなかなか増えません。代理人が来シーズンのレンタル移籍の話を切り出します。',
  askLabel: 'クラブにレンタル移籍を申し出る',
  askResult: 'クラブが申し出を受け入れました。シーズンが終わったらレンタル先を探してくれます。',
  stayLabel: '残ってレギュラー争いをする',
  stayResult: '練習場に誰よりも早く来て、誰よりも遅く帰りました。監督が注目し始めました。',
  stayFail: '歯を食いしばって耐えましたが、次の試合のメンバーにも名前はありませんでした。',
};
