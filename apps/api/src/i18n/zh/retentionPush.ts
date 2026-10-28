import type { RetentionStory } from '../ko/retentionPush.js';

export const retentionPushText: Record<RetentionStory, { title: string; body: string }> = {
  career: {
    title: '你的球員還在等你',
    body: '在首頁點「繼續」，就能從上次停下的地方接著玩。',
  },
  matches: {
    title: '休息期間踢了 {n} 場排位賽',
    body: '{w} 勝 {d} 和 {l} 敗。可以在我的球隊的近期比賽查看結果。',
  },
  sold: {
    title: '休息期間賣出了 {n} 名球員',
    body: '可以在轉會市場的交易紀錄查看售出內容和球隊資金。',
  },
  season: {
    title: '新賽季開打了',
    body: '第 {season} 賽季的排名從零開始。',
  },
  news: {
    title: '休息期間有些新變化',
    body: '新功能都整理在更新消息裡了。',
  },
  farewell: {
    title: '你的生涯都還保留著',
    body: '隨時都能從首頁接著玩。這是最後一則提醒，之後不會再發送。',
  },
  create: {
    title: '來建立第一位球員吧',
    body: '建立球員後，出道賽季馬上開始。',
  },
  retire: {
    title: '出道的球員正在等你',
    body: '打到退役就能拿到球員卡，還能建立自己的球隊。',
  },
  login: {
    title: '用退役球員建立球隊吧',
    body: '用 Google 或 Apple 登入就能建立球隊，換手機也能延續紀錄。',
  },
  club: {
    title: '用退役球員卡建立球隊吧',
    body: '建立球隊後，就能和其他球隊老闆打排位賽。',
  },
  rank: {
    title: '輪到你的第一場排位賽了',
    body: '在我的球隊挑選對手，開始比賽吧。',
  },
};
