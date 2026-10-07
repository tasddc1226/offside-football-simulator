import type { Translation } from '../core';
import type { HofOwnMsgs } from '../ko/hofOwn';

export const hofOwn: Translation<HofOwnMsgs> = {
  publishTitle: '全体の殿堂で名前を公開',
  publishBefore: '引退記録は全ユーザーが見る殿堂に載ります。いまは',
  publishNamed: (p) => `「${p.name}」の名前で`,
  publishAnon: '匿名で',
  publishAfter: '表示されています。',
  publishHint:
    '名前を公開すると、ほかのユーザーに選手名が表示されます。本名は使わないことをおすすめします。',
  publishRevert: '匿名に戻す',
  publishOn: '名前を公開する',
  shortTitle: '自分の選手にだけ残る記録',
  reportTitle: (p) => `「${p.name}」という名前を通報しますか？`,
  reportBody: '運営が確認してから対応します。',
  reportConfirm: '通報',
  reportSent: '通報しました。運営が確認します。',
  reportDone: '通報済み',
  reportBtn: '名前を通報',
  reportLabel: (p) => `${p.name}の名前を通報`,
  nickSaved: 'ニックネームを決めました',
  nickLabel: 'コメント用ニックネーム',
  nickPlaceholder: (p) => `コメント用ニックネーム（2〜${p.max}文字）`,
  nickChange: '変更',
  nickSet: '決定',
};
