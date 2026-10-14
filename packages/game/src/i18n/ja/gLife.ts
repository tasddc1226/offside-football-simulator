import type { Translation } from '@offside/contracts/i18n';
import type { gLifeText } from '../ko/gLife';
export const gLife: Translation<typeof gLifeText> = {
  ntTitle: '代表引退の悩み',
  ntText: (p) =>
    `Aマッチ${p.caps}試合目の招集から戻りました。所属クラブの日程も重なり、体が重く感じます。記者が代表引退の予定を尋ねます。`,
  ntRetireLabel: '代表引退を発表する',
  ntRetireResult: (p) =>
    `Aマッチ${p.caps}試合を最後に代表のユニフォームを脱ぎました。これからは所属クラブの試合だけに出ます。`,
  ntStayLabel: '次の招集にも応じると答える',
  ntStayResult: '「呼ばれればいつでも行きます」と短く答え、クラブの練習場に戻りました。',
  ntRetiredLog: (p) => `代表引退を発表(Aマッチ${p.caps}試合)`,
  wagsTitle: 'パーティー後の連絡',
  wagsText:
    'パーティーで挨拶した歌手出身のタレントからメッセージが届きました。来週一緒に夕食をとろうと言っています。',
  wagsPublicLabel: 'レストランで堂々と会う',
  wagsPublicResult:
    '食事の写真が記事になりました。二人は公認の恋人になり、スタンドで応援する姿が中継に映りました。',
  wagsPublicFail:
    '写真が先に広まり、熱愛報道が相次ぎました。翌日、練習場の前は記者でいっぱいでした。',
  wagsQuietLabel: '人目のない場所で静かに会う',
  wagsQuietResult: '二人だけの行きつけの店ができました。試合前夜でも気持ちが落ち着きます。',
  wagsDeclineLabel: 'シーズン中なので丁寧に断る',
  wagsDeclineResult: '「シーズンが終わったら連絡します」と返信し、映像分析室へ向かいました。',
};
