import type { Translation } from '../core';
import type { LeagueNewsMsgs } from '../ko/leagueNews';

const pick = (v: number, list: string[]) => list[Math.abs(v) % list.length]!;

export const leagueNews: Translation<LeagueNewsMsgs> = {
  title: 'OFFSIDE 日報',
  edition: (p) => `第 ${p.round} 輪消息`,
  firstSoon: '第 1 輪結束後會出第一份報紙。',
  loadFail: '無法載入報紙。',
  quiet: '這一輪沒有大新聞。',
  where: (p) => `第${p.tier}級 ${p.league} 聯賽 · 第 ${p.round} 輪`,
  tagUpset: '爆冷',
  tagGoalfest: '進球大戰',
  tagDerby: '德比',
  tagTeamOfRound: '本輪最佳球隊',
  tagLeader: '領頭羊',
  tagStreak: '連勝',
  tagComeback: '逆轉勝',
  tagLateWinner: '絕殺',
  tagHattrick: '帽子戲法',
  tagFirstWin: '首勝',
  tagBig: '焦點戰',
  upsetHead: (p) =>
    pick(p.v, [
      `${p.winner} 逆轉 ${p.gap} 點 OVR 差距`,
      `爆冷主角 ${p.winner} 擊倒 ${p.loser}`,
      `${p.loser} 意外失手，${p.winner} 上演逆襲`,
      `不被看好的 ${p.winner} 跌破眼鏡`,
    ]),
  upsetBody: (p) =>
    pick(p.v, [
      `${p.winner} 以 ${p.score} 擊敗 ${p.loser}。賽前 ${p.loser} 的 OVR 高出 ${p.gap}。`,
      `${p.gap} 點的 OVR 劣勢只是數字。${p.winner} 以 ${p.score} 絆倒了 ${p.loser}。`,
      `沒人料到這個結果。${p.loser} 低頭離場，${p.winner} 以 ${p.score} 帶走 3 分。`,
    ]),
  goalfestHead: (p) =>
    pick(p.v, [
      `${p.home} 對 ${p.away}，${p.goals} 球大戰`,
      `進球如雨，${p.home} 對 ${p.away} 打進 ${p.goals} 球`,
      `防守休假，${p.goals} 球對轟`,
    ]),
  goalfestBody: (p) =>
    pick(p.v, [
      `${p.home} 與 ${p.away} 的比賽打進 ${p.goals} 球，最終比數 ${p.score}。`,
      `雙方前鋒不停撕破球網，90 分鐘內打進 ${p.goals} 球，最終 ${p.score}。`,
      `看台上沒有片刻安靜。${p.home} 與 ${p.away} 互有攻守共進 ${p.goals} 球，比數 ${p.score}。`,
    ]),
  derbyHead: (p) => {
    const hi = Math.min(p.homeRank, p.awayRank);
    const lo = Math.max(p.homeRank, p.awayRank);
    return pick(p.v, [
      `第 ${hi} 名對第 ${lo} 名`,
      `排名之戰，第 ${hi} 名對決第 ${lo} 名`,
      `六分之戰，第 ${hi} 名碰上第 ${lo} 名`,
    ]);
  },
  derbyWin: (p) =>
    pick(p.v, [
      `${p.winner} 以 ${p.score} 擊退 ${p.loser}，在排名爭奪中搶先一步。`,
      `排名相鄰的對決由 ${p.winner} 勝出，${p.score} 的勝利拉開了與 ${p.loser} 的差距。`,
    ]),
  derbyDraw: (p) =>
    pick(p.v, [
      `${p.home} 與 ${p.away} 以 ${p.score} 握手言和，排名之爭延續到下一輪。`,
      `誰也不退讓。${p.score} 平手，兩隊各取 1 分。`,
    ]),
  teamOfRoundHead: (p) =>
    pick(p.v, [
      `${p.team} ${p.margin} 球完勝`,
      `本輪最佳球隊是 ${p.team}`,
      `${p.team} 以壓倒性表現大勝 ${p.margin} 球`,
    ]),
  teamOfRoundBody: (p) =>
    pick(p.v, [
      `${p.winner} 以 ${p.score} 大勝 ${p.loser}。`,
      `比賽主導權始終在 ${p.winner} 手中，${p.loser} 毫無招架之力，以 ${p.score} 落敗。`,
    ]),
  leaderNewHead: (p) =>
    pick(p.v, [
      `${p.team} 登上第${p.tier}級榜首`,
      `第${p.tier}級新霸主 ${p.team}`,
      `${p.team} 終於登頂`,
    ]),
  leaderKeepHead: (p) =>
    pick(p.v, [`${p.team} 守住榜首`, `不動如山的 ${p.team} 依然第一`, `${p.team} 繼續獨走`]),
  leaderNewBody: (p) => `${p.team} 以 ${p.points} 分登上第${p.tier}級第 1 名。`,
  leaderKeepBody: (p) => `${p.team} 以 ${p.points} 分守住第${p.tier}級第 1 名。`,
  streakHead: (p) =>
    pick(p.v, [
      `${p.team} ${p.n} 連勝`,
      `勢不可擋的 ${p.team}，已經 ${p.n} 連勝`,
      `${p.team} 氣勢如虹，${p.n} 連勝`,
    ]),
  streakBody: (p) => `${p.team} 已連續贏下 ${p.n} 場比賽。`,
  comebackHead: (p) =>
    pick(p.v, [
      `${p.team} 落後 ${p.n} 球逆轉取勝`,
      `永不放棄，${p.team} 上演大逆轉`,
      `一度落後的 ${p.team} 扭轉戰局`,
    ]),
  comebackBody: (p) =>
    pick(p.v, [
      `${p.winner} 一度落後 ${p.n} 球，最終以 ${p.score} 擊敗 ${p.loser}。`,
      `${p.loser} 先馳得點，但 ${p.winner} 接連破門，完成 ${p.score} 的逆轉勝。`,
    ]),
  lateHead: (p) =>
    pick(p.v, [
      `第 ${p.minute} 分鐘的奇蹟，${p.team} 絕殺`,
      `${p.team} 終場前致勝`,
      `笑到最後的是 ${p.team}`,
    ]),
  lateBody: (p) =>
    pick(p.v, [
      `第 ${p.minute} 分鐘 ${p.name} 的進球決定勝負，${p.winner} 以 ${p.score} 擊敗 ${p.loser}。`,
      `看似以和局收場的比賽在第 ${p.minute} 分鐘生變，${p.name} 打進致勝球，${p.winner} 以 ${p.score} 獲勝。`,
    ]),
  hattrickHead: (p) =>
    pick(p.v, [
      `${p.name} ${p.goals} 球個人秀`,
      `${p.team} 的 ${p.name} 上演帽子戲法`,
      `一人包辦 ${p.goals} 球，屬於 ${p.name} 的一天`,
    ]),
  hattrickBody: (p) =>
    pick(p.v, [
      `${p.team} 的 ${p.name} 單場打進 ${p.goals} 球，比賽以 ${p.score} 結束。`,
      `${p.name} 在球門前毫不留情，以 ${p.goals} 球成為全場焦點（${p.score}）。`,
    ]),
  firstWinHead: (p) =>
    pick(p.v, [
      `${p.team} 第 ${p.n} 場拿下本季首勝`,
      `苦等的首勝，${p.team}`,
      `${p.team} 終於嘗到勝利滋味`,
    ]),
  firstWinBody: (p) =>
    pick(p.v, [
      `${p.winner} 以 ${p.score} 擊敗 ${p.loser}，第 ${p.n} 場終於拿下首勝。`,
      `本季未嘗勝績的 ${p.winner} 終於笑了，${p.score} 的勝利為反彈打下基礎。`,
    ]),
  youth: '青訓球員',
  xgLine: (p) => `預期進球為 ${p.hx} 比 ${p.ax}。`,
  articleTitle: '賽事報導',
  articleDraw: (p) => `${p.home} 對 ${p.away}，${p.score} 平手`,
  articleDrawBody: (p) => `${p.home} 與 ${p.away} 以 ${p.score} 各取 1 分。`,
  articleLucky: (p) => `${p.winner} 被壓制仍拿下勝利`,
  articleLuckyBody: (p) =>
    `預期進球 ${p.loser} ${p.lx}、${p.winner} ${p.wx}，但 ${p.score} 的勝利屬於 ${p.winner}。`,
  articleRout: (p) => `${p.winner} ${p.margin} 球大勝`,
  articleUpset: (p) => `${p.winner} 擊敗實力更強的 ${p.loser}`,
  articleNarrow: (p) => `${p.winner} 一球小勝`,
  articleWin: (p) => `${p.winner} 以 ${p.score} 擊敗 ${p.loser}`,
  articleWinBody: (p) => `${p.winner} 以 ${p.score} 贏下 ${p.loser}。`,
  articleFirst: (p) => `第 ${p.minute} 分鐘 ${p.name} 首開紀錄。`,
  articleLate: (p) => `第 ${p.minute} 分鐘 ${p.name} 的進球決定了勝負。`,
  articleBrace: (p) => (p.n >= 3 ? `${p.name} 上演帽子戲法。` : `${p.name} 梅開二度。`),
  articleGoalless: '兩隊都沒能攻破球門。',
  readArticle: '閱讀報導',
  shareAct: '分享到交誼廳',
  shareAria: (p) => `把 ${p.home} 對 ${p.away} 的報導分享到交誼廳`,
  chatTag: 'OFFSIDE 日報',
  chatOpen: '在聯賽中查看',
  bigTitle: '焦點戰預測',
  bigWhen: (p) => `${p.when} 開賽 · 沒有獎勵，只留下命中紀錄。`,
  rankOvr: (p) => `第 ${p.rank} 名 · OVR ${p.ovr}`,
  pickHome: '主隊勝',
  pickDraw: '和局',
  pickAway: '客隊勝',
  picked: (p) => `我的預測：${p.pick}`,
  pickLogin: '登入後即可預測。',
  pickSaved: '已儲存預測。',
  pickFail: '無法儲存預測。',
  pickSplit: (p) => `${p.n} 人預測 · 主 ${p.home}% · 和 ${p.draw}% · 客 ${p.away}%`,
  record: (p) => `我的命中 ${p.hit}/${p.total}`,
  lastBig: (p) => `上一場焦點戰 ${p.home} ${p.score} ${p.away}`,
  rivalTag: '宿敵',
  derbyTag: '德比',
  rivalLine: (p) => `宿敵 ${p.team} · 積分差 ${p.gap} · 交手 ${p.w}勝 ${p.d}和 ${p.l}負`,
};
