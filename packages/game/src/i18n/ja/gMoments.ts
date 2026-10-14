import type { Translation } from '@offside/contracts/i18n';
import type { gMomentsText } from '../ko/gMoments';
export const gMoments: Translation<typeof gMomentsText> = {
  kidTitle: '子どもファンのサイン',
  kidText: (p) =>
    `試合後、バスへ向かう途中で子どものファンがペンを差し出します。「${p.name}選手、サインください！」`,
  kidShirtLabel: '着ていたユニフォームを脱いで渡す',
  kidShirtResult:
    'ユニフォームを受け取った子がその場で跳びはねました。近くで撮られた動画が翌日SNSで広まりました。',
  kidSignLabel: '疲れた体でサインをする',
  kidSignResult:
    '並んだ子どもたち一人ひとりにサインしてバスに乗りました。脚は重くても気分は軽くなりました。',

  wcTitle: 'ワールドカップメンバー落選',
  wcText:
    '昨夏のワールドカップ最終メンバーにあなたの名前はありませんでした。新シーズン前の会見で記者が心境を尋ねます。',
  wcQuitLabel: '監督を批判し、代表招集の拒否を宣言する',
  wcQuitResult:
    '「今の監督の下ではプレーしません」記事が相次ぎ、世論は二つに割れました。今後2シーズン、A代表の招集に応じません。',
  wcCalmLabel: '残念だと伝え、シーズンの準備に集中する',
  wcCalmResult:
    '「悔しいですが、自分の力不足です」短く答えて練習場へ向かいました。代表スタッフもその答えを見ていました。',

  legendTitle: '代表レジェンドの公開批判',
  legendText:
    '代表レジェンド出身の解説者が放送であなたを公然と批判しました。「名前ほどのものは何も見せていない」',
  legendReplyLabel: 'SNSで反論する',
  legendReplyOk:
    '最近の試合記録を画像で投稿しました。コメントはあなたの味方に傾き、解説者は次の放送で言葉を控えました。',
  legendReplyFail:
    '反論が言い争いに発展しました。次の試合で不調な場面が出るたびに、その投稿が掘り返されます。',
  legendIgnoreLabel: '相手にしない',
  legendIgnoreResult: '何も言わずに練習へ向かいました。数日後、話題は別のところへ移りました。',

  hatTitle: 'ハットトリックとMOM',
  hatText:
    'ハットトリックを決め、マン・オブ・ザ・マッチに選ばれました。トロフィーを掲げたあなたに記者がマイクを向けます。',
  hatTeamLabel: '仲間のおかげだと話す',
  hatTeamResult:
    '「3点とも仲間が作ってくれたゴールです」ロッカールームでは仲間が試合球を持って待っていました。',
  hatFatherLabel: '父にこのゴールを捧げる',
  hatFatherResult:
    '「初めてボールを買ってくれた父に捧げます」スタンドで立ち上がって手を振る父の姿が中継に映りました。',

  papTitle: 'パパラッチ',
  papText: '恋人と街を歩いていると、パパラッチのカメラと目が合いました。シャッター音が続きます。',
  papSmileLabel: 'カメラに向かって笑顔を見せる',
  papSmileResult:
    '手を振って通り過ぎました。翌日写真が記事になり、「余裕がある」というコメントが目立ちました。',
  papRunLabel: '恋人の手を取って逃げる',
  papRunOk: '路地へ抜け出しました。ぶれた写真しか残らず、記事はすぐに埋もれました。',
  papRunFail:
    '走って逃げる後ろ姿がはっきり撮られました。「逃走デート」という見出しの記事があふれました。',

  coachTitle: '恩師の訃報',
  coachText:
    'ユース時代にあなたを見いだした監督が亡くなったと連絡を受けました。葬儀は試合当日です。',
  coachFuneralLabel: '試合を欠場して葬儀に行く',
  coachFuneralResult:
    '最後まで弔問に付き添いました。監督の家族から、あなたのデビュー戦の写真が入った額を手渡されました。',
  coachDedicateLabel: '監督に試合を捧げる',
  coachDedicateOk:
    '試合後、空を指さして黒い喪章に口づけしました。その写真が翌日の一面を飾りました。',
  coachDedicateFail: '体が重く感じました。後半半ばに交代し、ベンチで黒い喪章を触り続けました。',
};
