import type { Translation } from '../core';
import type { AttendanceMsgs } from '../ko/attendance';

export const attendance: Translation<AttendanceMsgs> = {
  title: '出席チェック',
  streak: (p) => `${p.n}日連続`,
  board: (p) => `スタンプ ${p.filled}/${p.total}`,
  todayLabel: '今日の報酬',
  tomorrowLabel: '明日の報酬',
  grace:
    '毎日出席するとその日のマスの報酬がもらえます。休んだ日があってもスタンプは残り、週に1日までは休んでも連続記録が続きます。',
  btn: '出席する',
  busy: '押しています…',
  checked: '今日のスタンプを押しました',
  stamped: (p) => `${p.n}個目のスタンプを押しました。もらったアイテム: ${p.reward}`,
  fail: '出席できませんでした。しばらくしてからもう一度押してください。',
  reroll: (p) => `リロール券${p.n}枚`,
  boost: (p) => `ポテンシャル強化券${p.n}枚`,
  scout: (p) => `プレミアムスカウト券${p.n}枚`,
<<<<<<< HEAD
  rename: (p) => `選手名変更券${p.n}枚`,
=======
>>>>>>> origin/main
  itemReroll: 'リロール券',
  itemBoost: 'ポテンシャル強化券',
  itemScout: 'プレミアムスカウト券',
  boardLabel: (p) => `スタンプ${p.total}個中${p.filled}個を集めました`,
  entryToday: (p) => `今日の報酬 · ${p.reward}`,
  entryDone: '今日のスタンプ済み',
  entryGuest: 'ログインで毎日報酬',
  entryLabel: '出席チェックを開く',
  close: '閉じる',
  guestLead: (p) =>
    `ログインすると毎日出席して報酬がもらえます。${p.days}日間でもらえる報酬: ${p.reward}`,
};
