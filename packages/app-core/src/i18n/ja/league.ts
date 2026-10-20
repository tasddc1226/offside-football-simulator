import type { Translation } from '../core';
import type { LeagueMsgs } from '../ko/league';

export const league: Translation<LeagueMsgs> = {
  title: 'オフサイドリーグ',
  seasonTitle: (p) => `シーズン${p.season} オフサイドリーグ`,
  open: 'リーグを見る',
  loadFail: 'リーグ情報を読み込めませんでした。',
  pitch:
    '1リーグ8チームがホーム・アウェーで2回ずつ対戦し、14節を戦います。順位で次のシーズンの部が上下します。',
  phaseSoon: '受付予定',
  phaseOpen: '受付中',
  phaseClosed: '組分け待ち',
  phaseRunning: '開催中',
  phaseDone: '終了',
  soonLine: (p) => `${p.at}から受け付けます。`,
  openLine: (p) => `${p.entries}チーム申込 · ${p.until}まで`,
  closedLine: (p) => `${p.at}に部とリーグの組分けを発表します。`,
  runningLine: 'リーグ戦を開催中です。',
  doneLine: '今シーズンのリーグは終了しました。',
  scheduleTitle: '日程',
  scheduleEntry: '申込',
  scheduleSeason: (p) => `シーズン${p.season}開幕`,
  scheduleDraw: '組分け・対戦発表',
  scheduleRounds: '第1〜14節',
  date: (p) => `${p.month}月${p.day}日`,
  range: (p) => `${p.from} 〜 ${p.to}`,
  daily: (p) => `${p.from} 〜 ${p.to}、毎日${p.time}`,
  rulesTitle: 'ルール',
  ruleEntry:
    'シーズン開幕の7日前から申し込めます。組分け時にそのシーズンのチームのスタメンに自分の引退選手が8人未満なら、リーグから外れます。',
  ruleTiers:
    '1部はリーグ1つ、2部は2つのように下の部ほどリーグが2倍に増えます。最初のシーズンは受付締切時のチームOVR順に上の部から埋めます。',
  rulePoints: '勝ち3点、引き分け1点です。勝点が同じなら得失点差、総得点、直接対決の順で決めます。',
  ruleMove: '各リーグの1位は次のシーズン1つ上の部へ、7・8位は1つ下の部へ移ります。',
  ruleLock: '試合1時間前から試合終了までチームのメンバーを変更できません。移籍市場は止めません。',
  ruleForfeit:
    '試合時にスタメンの自分の引退選手が8人未満なら0-3の負けです。3回棄権すると残り試合もすべて0-3の負けになり、次のシーズンは一番下の部から始まります。',
  ruleReward:
    '報酬はクラブ資金ではなく、トロフィー・称号・アイテムです。シーズン終了時に受け取れます。',
  entries: (p) => `申込${p.n}チーム`,
  loginToEnter: 'ログインするとリーグに申し込めます。',
  enter: 'リーグに申し込む',
  entering: '申し込み中…',
  entered: '申込済み',
  withdraw: '申込を取り消す',
  withdrawing: '取り消し中…',
  withdrawConfirm: 'リーグの申込を取り消しますか？受付期間中は再び申し込めます。',
  toastEntered: 'リーグに申し込みました。',
  toastWithdrawn: 'リーグの申込を取り消しました。',
  enteredNote: (p) => `${p.at}に組分けを発表します。そのときのチームOVRで部とリーグが決まります。`,
  myOvr: (p) => `現在のチームOVR ${p.ovr}`,
  presignNote: (p) =>
    `シーズン${p.season}の開幕前でも申し込めます。シーズン${p.season}のチームは${p.at}の開幕から作れます。`,
  readyOk: (p) => `準備完了 · スタメンに自分の引退選手${p.filled}人`,
  readyShort: (p) =>
    `スタメンの自分の引退選手は${p.filled}/${p.min}人です。組分けまでに${p.min}人そろえるとリーグに入れます。`,
  readyNoTeam: (p) =>
    `シーズン${p.season}のチームがまだありません。組分けまでにチームを作り、スタメンに自分の引退選手を${p.min}人そろえるとリーグに入れます。`,
  notEntered: '今シーズンのリーグには申し込んでいません。',
  drawPending: '組分け・対戦は発表後にこの画面に表示されます。',
};
