import type { Translation } from '../core';
import type { LeagueNewsMsgs } from '../ko/leagueNews';

const pick = (v: number, list: string[]) => list[Math.abs(v) % list.length]!;

export const leagueNews: Translation<LeagueNewsMsgs> = {
  title: 'オフサイド・デイリー',
  edition: (p) => `第${p.round}節のニュース`,
  firstSoon: '第1節が終わると最初の新聞が出ます。',
  loadFail: '新聞を読み込めませんでした。',
  quiet: 'この節は大きなニュースがありませんでした。',
  where: (p) => `${p.tier}部${p.league}リーグ · 第${p.round}節`,
  tagUpset: '番狂わせ',
  tagGoalfest: '乱打戦',
  tagDerby: 'ダービー',
  tagTeamOfRound: '今節のチーム',
  tagLeader: '首位',
  tagStreak: '連勝',
  tagComeback: '逆転勝ち',
  tagLateWinner: '劇的ゴール',
  tagHattrick: 'ハットトリック',
  tagFirstWin: '初勝利',
  tagBig: 'ビッグマッチ',
  aiBadge: 'AI記者',
  aiNote: 'AI記者が試合結果をもとに書いた記事です。',
  upsetHead: (p) =>
    pick(p.v, [
      `${p.winner}、OVR差${p.gap}をひっくり返す`,
      `番狂わせの主役${p.winner}、${p.loser}を倒す`,
      `${p.loser}まさかの黒星、${p.winner}の反乱`,
      `下馬評を覆した${p.winner}`,
    ]),
  upsetBody: (p) =>
    pick(p.v, [
      `${p.winner}が${p.loser}を${p.score}で破った。試合前のOVRは${p.loser}が${p.gap}上だった。`,
      `OVR差${p.gap}は数字にすぎなかった。${p.winner}が${p.score}で${p.loser}の足をすくった。`,
      `誰も予想しなかった結果だ。${p.loser}はうなだれ、${p.winner}が${p.score}で勝点3を持ち帰った。`,
    ]),
  goalfestHead: (p) =>
    pick(p.v, [
      `${p.home}対${p.away}、${p.goals}ゴールの乱打戦`,
      `ゴールの雨、${p.goals}ゴールが生まれた${p.home}対${p.away}`,
      `守備はお休み、${p.goals}ゴールの撃ち合い`,
    ]),
  goalfestBody: (p) =>
    pick(p.v, [
      `${p.home}と${p.away}の試合で${p.goals}ゴールが生まれた。最終スコアは${p.score}だった。`,
      `両チームの攻撃陣が休まずネットを揺らした。90分で${p.goals}ゴールが飛び交い、${p.score}で終わった。`,
      `スタンドは息つく暇もなかった。${p.home}と${p.away}が奪い合ったゴールは計${p.goals}、スコアは${p.score}だった。`,
    ]),
  derbyHead: (p) => {
    const hi = Math.min(p.homeRank, p.awayRank);
    const lo = Math.max(p.homeRank, p.awayRank);
    return pick(p.v, [
      `${hi}位と${lo}位の直接対決`,
      `順位を懸けた一戦、${hi}位対${lo}位`,
      `勝点6の価値がある一戦、${hi}位と${lo}位が激突`,
    ]);
  },
  derbyWin: (p) =>
    pick(p.v, [
      `${p.winner}が${p.loser}を${p.score}で退け、順位争いで一歩抜け出した。`,
      `順位が隣り合う両者の対決は${p.winner}に軍配。${p.score}の勝利で${p.loser}との差を広げた。`,
    ]),
  derbyDraw: (p) =>
    pick(p.v, [
      `${p.home}と${p.away}は${p.score}で引き分けた。順位争いは次の節へ持ち越しだ。`,
      `どちらも譲らなかった。${p.score}の引き分けで勝点1を分け合った。`,
    ]),
  teamOfRoundHead: (p) =>
    pick(p.v, [
      `${p.team}、${p.margin}点差の完勝`,
      `今節のチームは${p.team}`,
      `${p.team}、圧倒的な内容で${p.margin}点差の大勝`,
    ]),
  teamOfRoundBody: (p) =>
    pick(p.v, [
      `${p.winner}が${p.loser}に${p.score}で大勝した。`,
      `試合の主導権は終始${p.winner}にあった。${p.loser}はなす術なく${p.score}で崩れた。`,
    ]),
  leaderNewHead: (p) =>
    pick(p.v, [
      `${p.team}、${p.tier}部首位に浮上`,
      `${p.tier}部の新たな主役${p.team}`,
      `${p.team}、ついに頂点へ`,
    ]),
  leaderKeepHead: (p) =>
    pick(p.v, [`${p.team}、首位を守る`, `揺るがない${p.team}、依然首位`, `${p.team}の独走は続く`]),
  leaderNewBody: (p) => `${p.team}が勝点${p.points}で${p.tier}部の首位に立った。`,
  leaderKeepBody: (p) => `${p.team}が勝点${p.points}で${p.tier}部の首位を守った。`,
  streakHead: (p) =>
    pick(p.v, [
      `${p.team}、${p.n}連勝`,
      `止まらない${p.team}、早くも${p.n}連勝`,
      `${p.team}の勢い、${p.n}連勝`,
    ]),
  streakBody: (p) => `${p.team}が${p.n}試合連続で勝利した。`,
  comebackHead: (p) =>
    pick(p.v, [
      `${p.team}、${p.n}点差からの逆転勝ち`,
      `諦めなかった${p.team}の大逆転劇`,
      `追う展開の${p.team}、試合をひっくり返す`,
    ]),
  comebackBody: (p) =>
    pick(p.v, [
      `${p.winner}が${p.n}点ビハインドから${p.loser}を${p.score}で破った。`,
      `先に笑ったのは${p.loser}だった。だが${p.winner}が次々とゴールを奪い、${p.score}の逆転勝ちを完成させた。`,
    ]),
  lateHead: (p) =>
    pick(p.v, [
      `${p.minute}分の奇跡、${p.team}の劇的ゴール`,
      `${p.team}、終了間際の決勝点`,
      `最後に笑ったのは${p.team}`,
    ]),
  lateBody: (p) =>
    pick(p.v, [
      `${p.minute}分、${p.name}のゴールが勝負を決めた。${p.winner}が${p.loser}を${p.score}で破った。`,
      `引き分けで終わるかに見えた試合は${p.minute}分に動いた。${p.name}が決勝点を挙げ、${p.winner}が${p.score}で勝った。`,
    ]),
  hattrickHead: (p) =>
    pick(p.v, [
      `${p.name}、${p.goals}ゴールのワンマンショー`,
      `${p.team}の${p.name}、ハットトリック`,
      `一人で${p.goals}ゴール、${p.name}の日`,
    ]),
  hattrickBody: (p) =>
    pick(p.v, [
      `${p.team}の${p.name}が1試合で${p.goals}ゴールを挙げた。試合は${p.score}で終わった。`,
      `${p.name}はゴール前で容赦なかった。${p.goals}ゴールの活躍で試合の主役となった（${p.score}）。`,
    ]),
  firstWinHead: (p) =>
    pick(p.v, [
      `${p.team}、${p.n}試合目で今季初勝利`,
      `待望の初勝利、${p.team}`,
      `${p.team}、ついに勝利の味`,
    ]),
  firstWinBody: (p) =>
    pick(p.v, [
      `${p.winner}が${p.loser}を${p.score}で破り、${p.n}試合目で初勝利を挙げた。`,
      `今季未勝利だった${p.winner}がついに笑った。${p.score}の勝利で反撃の足がかりをつかんだ。`,
    ]),
  youth: 'ユース選手',
  xgLine: (p) => `期待ゴールは${p.hx}対${p.ax}だった。`,
  articleTitle: '試合記事',
  articleDraw: (p) => `${p.home}対${p.away}、${p.score}で引き分け`,
  articleDrawBody: (p) => `${p.home}と${p.away}は${p.score}で勝点1を分け合った。`,
  articleLucky: (p) => `${p.winner}、押されながらも勝利`,
  articleLuckyBody: (p) =>
    `期待ゴールは${p.loser}${p.lx}、${p.winner}${p.wx}だったが、${p.score}の勝利は${p.winner}のものだった。`,
  articleRout: (p) => `${p.winner}、${p.margin}点差の大勝`,
  articleUpset: (p) => `${p.winner}、格上の${p.loser}を倒す`,
  articleNarrow: (p) => `${p.winner}、1点差で逃げ切る`,
  articleWin: (p) => `${p.winner}、${p.loser}に${p.score}で勝利`,
  articleWinBody: (p) => `${p.winner}が${p.loser}に${p.score}で勝った。`,
  articleFirst: (p) => `先制点は${p.minute}分、${p.name}が決めた。`,
  articleLate: (p) => `${p.minute}分の${p.name}のゴールが勝負を決めた。`,
  articleBrace: (p) =>
    p.n >= 3 ? `${p.name}がハットトリックを達成した。` : `${p.name}が2ゴールを挙げた。`,
  articleGoalless: '両チームともゴールを割れなかった。',
  readArticle: '記事を読む',
  shareAct: 'ラウンジで共有',
  shareAria: (p) => `${p.home}対${p.away}の記事をラウンジで共有`,
  chatTag: 'オフサイド・デイリー',
  chatOpen: 'リーグで見る',
  bigTitle: 'ビッグマッチ予想',
  bigWhen: (p) => `${p.when}キックオフ · 報酬はなく、的中記録だけが残ります。`,
  rankOvr: (p) => `${p.rank}位 · OVR ${p.ovr}`,
  pickHome: 'ホーム勝ち',
  pickDraw: '引き分け',
  pickAway: 'アウェー勝ち',
  picked: (p) => `私の予想: ${p.pick}`,
  pickLogin: 'ログインすると予想できます。',
  pickSaved: '予想を保存しました。',
  pickFail: '予想を保存できませんでした。',
  pickSplit: (p) => `${p.n}人が予想 · ホーム${p.home}% · 引き分け${p.draw}% · アウェー${p.away}%`,
  record: (p) => `私の的中 ${p.hit}/${p.total}`,
  lastBig: (p) => `前回のビッグマッチ ${p.home} ${p.score} ${p.away}`,
  rivalTag: 'ライバル',
  derbyTag: 'ダービー',
  rivalLine: (p) => `ライバル ${p.team} · 勝点差${p.gap} · 直接対決 ${p.w}勝${p.d}分${p.l}敗`,
};
