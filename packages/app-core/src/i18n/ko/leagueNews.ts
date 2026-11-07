// T-11-652 오프사이드 데일리(라운드 신문) · 경기 기사 · 빅매치 예측 · 라이벌. 웹 · 앱이 함께 쓴다.
// 기사 문장(헤드라인 아래 본문)은 게임 속 기사라 합니다체, 화면 안내는 해요체다(copy-style).
import { iGa, waGwa, withEulReul } from '../../format.js';
import { ns } from '../core';

type Score = { score: string };
/** 숫자 뒤 '였/이었'(받침이 있으면 이었). */
const was = (n: string) => `${n}${iGa(n) === '이' ? '이었' : '였'}`;
type Pair = { home: string; away: string };
type Win = { winner: string; loser: string };

const ko = {
  title: '오프사이드 데일리',
  edition: (p: { round: number }) => `${p.round}라운드 소식`,
  firstSoon: '1라운드가 끝나면 첫 신문이 나와요.',
  loadFail: '신문을 불러오지 못했어요.',
  quiet: '이 라운드에는 큰 소식이 없었어요.',
  where: (p: { tier: number; league: number; round: number }) =>
    `${p.tier}부 ${p.league}리그 · ${p.round}라운드`,
  // 꼭지 이름
  tagUpset: '이변',
  tagGoalfest: '골 잔치',
  tagDerby: '더비',
  tagTeamOfRound: '이 라운드의 팀',
  tagLeader: '선두',
  tagStreak: '연승',
  tagBig: '빅매치',
  // 라운드 신문 헤드라인 · 본문
  upsetHead: (p: Win & { gap: number }) => `${p.winner}, OVR ${p.gap} 차를 뒤집다`,
  upsetBody: (p: Win & Score & { gap: number }) =>
    `${p.winner}${iGa(p.winner)} ${withEulReul(p.loser)} ${p.score}로 꺾었습니다. 경기 전 OVR은 ${p.loser} 쪽이 ${p.gap} 높았습니다.`,
  goalfestHead: (p: Pair & { goals: number }) => `${p.home} · ${p.away}, ${p.goals}골 난타전`,
  goalfestBody: (p: Pair & Score & { goals: number }) =>
    `${p.home}${waGwa(p.home)} ${p.away}의 경기에서 ${p.goals}골이 터졌습니다. 최종 스코어는 ${p.score}입니다.`,
  derbyHead: (p: { homeRank: number; awayRank: number }) =>
    `${Math.min(p.homeRank, p.awayRank)}위와 ${Math.max(p.homeRank, p.awayRank)}위의 맞대결`,
  derbyWin: (p: Win & Score) =>
    `${p.winner}${iGa(p.winner)} ${withEulReul(p.loser)} ${p.score}로 누르고 순위 싸움에서 앞섰습니다.`,
  derbyDraw: (p: Pair & Score) =>
    `${p.home}${waGwa(p.home)} ${p.away}는 ${p.score}로 비겼습니다. 순위 싸움은 다음 라운드로 넘어갑니다.`,
  teamOfRoundHead: (p: { team: string; margin: number }) => `${p.team}, ${p.margin}골 차 완승`,
  teamOfRoundBody: (p: Win & Score) =>
    `${p.winner}${iGa(p.winner)} ${withEulReul(p.loser)} ${p.score}로 크게 이겼습니다.`,
  leaderNewHead: (p: { team: string; tier: number }) => `${p.team}, ${p.tier}부 선두로`,
  leaderKeepHead: (p: { team: string }) => `${p.team}, 선두 자리 지켜`,
  leaderNewBody: (p: { team: string; tier: number; points: number }) =>
    `${p.team}${iGa(p.team)} 승점 ${p.points}점으로 ${p.tier}부 1위에 올랐습니다.`,
  leaderKeepBody: (p: { team: string; tier: number; points: number }) =>
    `${p.team}${iGa(p.team)} 승점 ${p.points}점으로 ${p.tier}부 1위를 지켰습니다.`,
  streakHead: (p: { team: string; n: number }) => `${p.team}, ${p.n}연승 행진`,
  streakBody: (p: { team: string; n: number }) =>
    `${p.team}${iGa(p.team)} ${p.n}경기 연속 이겼습니다.`,
  xgLine: (p: { hx: string; ax: string }) => `기대 득점은 ${p.hx} 대 ${was(p.ax)}습니다.`,
  // 경기 기사(경기 상세)
  articleTitle: '경기 기사',
  articleDraw: (p: Pair & Score) => `${p.home} · ${p.away}, ${p.score} 무승부`,
  articleDrawBody: (p: Pair & Score) =>
    `${p.home}${waGwa(p.home)} ${p.away}는 ${p.score}로 승점 1점씩 나눠 가졌습니다.`,
  articleLucky: (p: Win) => `${p.winner}, 밀리고도 이겼다`,
  articleLuckyBody: (p: Win & Score & { lx: string; wx: string }) =>
    `기대 득점은 ${p.loser} ${p.lx}, ${p.winner} ${was(p.wx)}지만 ${p.score} 승리는 ${p.winner}의 몫이었습니다.`,
  articleRout: (p: { winner: string; margin: number }) => `${p.winner}, ${p.margin}골 차 대승`,
  articleUpset: (p: Win) => `${p.winner}, 한 수 위 ${withEulReul(p.loser)} 잡다`,
  articleNarrow: (p: Win) => `${p.winner}, 한 골 차로 웃다`,
  articleWin: (p: Win & Score) => `${p.winner}, ${p.loser}에 ${p.score} 승리`,
  articleWinBody: (p: Win & Score) =>
    `${p.winner}${iGa(p.winner)} ${withEulReul(p.loser)} ${p.score}로 이겼습니다.`,
  articleFirst: (p: { minute: number; name: string }) =>
    `선제골은 ${p.minute}분 ${p.name}의 발끝에서 나왔습니다.`,
  articleLate: (p: { minute: number; name: string }) =>
    `${p.minute}분 ${p.name}의 골이 승부를 갈랐습니다.`,
  articleBrace: (p: { name: string; n: number }) =>
    p.n >= 3
      ? `${p.name}${iGa(p.name)} 해트트릭을 기록했습니다.`
      : `${p.name}${iGa(p.name)} 두 골을 넣었습니다.`,
  articleGoalless: '두 팀 모두 골문을 열지 못했습니다.',
  // 공유
  readArticle: '기사 읽기',
  shareAct: '라운지에 공유',
  shareAria: (p: Pair) => `${p.home} 대 ${p.away} 경기 기사를 라운지에 공유`,
  chatTag: '오프사이드 데일리',
  chatOpen: '리그에서 보기',
  // 빅매치 예측
  bigTitle: '빅매치 예측',
  bigWhen: (p: { when: string }) => `${p.when} 킥오프 · 보상 없이 적중 기록만 남아요.`,
  rankOvr: (p: { rank: number; ovr: number }) => `${p.rank}위 · OVR ${p.ovr}`,
  pickHome: '홈 승',
  pickDraw: '무승부',
  pickAway: '원정 승',
  picked: (p: { pick: string }) => `내 예측: ${p.pick}`,
  pickLogin: '로그인하면 예측할 수 있어요.',
  pickSaved: '예측을 저장했어요.',
  pickFail: '예측을 저장하지 못했어요.',
  pickSplit: (p: { home: number; draw: number; away: number; n: number }) =>
    `${p.n}명 예측 · 홈 ${p.home}% · 무 ${p.draw}% · 원정 ${p.away}%`,
  record: (p: { hit: number; total: number }) => `내 적중 ${p.hit}/${p.total}`,
  lastBig: (p: Pair & Score) => `지난 빅매치 ${p.home} ${p.score} ${p.away}`,
  // 라이벌 · 더비
  rivalTag: '라이벌',
  derbyTag: '더비',
  rivalLine: (p: { team: string; gap: number; w: number; d: number; l: number }) =>
    `라이벌 ${p.team} · 승점 차 ${p.gap} · 맞대결 ${p.w}승 ${p.d}무 ${p.l}패`,
};

export type LeagueNewsMsgs = typeof ko;
export const leagueNewsText = ns('leagueNews', ko);
