// T-11-652 오프사이드 데일리(라운드 신문) · 경기 기사 · 빅매치 예측 · 라이벌. 웹 · 앱이 함께 쓴다.
// 기사 문장(헤드라인 아래 본문)은 게임 속 기사라 합니다체, 화면 안내는 해요체다(copy-style).
import { iGa, waGwa, withEulReul } from '../../format.js';
import { ns } from '../core';

type Score = { score: string };
/** 변형 번호로 문장 하나를 고른다. */
const pick = (v: number, list: string[]) => list[Math.abs(v) % list.length]!;
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
  // T-11-658 AI 기자가 쓴 1면 표시
  aiBadge: 'AI 기자',
  aiNote: 'AI 기자가 경기 결과로 쓴 기사예요.',
  tagComeback: '역전승',
  tagLateWinner: '극장골',
  tagHattrick: '해트트릭',
  tagFirstWin: '첫 승',
  // 라운드 신문 헤드라인 · 본문. v는 기사마다 정해진 변형 번호라 같은 기사는 늘 같은 문장, 기사마다 다른 문장이 나온다.
  upsetHead: (p: Win & { gap: number; v: number }) =>
    pick(p.v, [
      `${p.winner}, OVR ${p.gap} 차를 뒤집다`,
      `이변의 주인공 ${p.winner}, ${withEulReul(p.loser)} 쓰러뜨리다`,
      `${p.loser} 덜미 잡혔다… ${p.winner}의 반란`,
      `약체 평가 비웃은 ${p.winner}`,
    ]),
  upsetBody: (p: Win & Score & { gap: number; v: number }) =>
    pick(p.v, [
      `${p.winner}${iGa(p.winner)} ${withEulReul(p.loser)} ${p.score}로 꺾었습니다. 경기 전 OVR은 ${p.loser} 쪽이 ${p.gap} 높았습니다.`,
      `OVR ${p.gap} 열세는 숫자에 불과했습니다. ${p.winner}${iGa(p.winner)} ${p.score} 승리로 ${p.loser}의 발목을 잡았습니다.`,
      `누구도 예상하지 못한 결과입니다. ${p.loser}${iGa(p.loser)} 고개를 숙였고, ${p.winner}${iGa(p.winner)} ${p.score}로 승점 3점을 가져갔습니다.`,
    ]),
  goalfestHead: (p: Pair & { goals: number; v: number }) =>
    pick(p.v, [
      `${p.home} · ${p.away}, ${p.goals}골 난타전`,
      `골, 골, 또 골… ${p.goals}골 터진 ${p.home} 대 ${p.away}`,
      `수비는 쉬었다, ${p.goals}골 공방전`,
    ]),
  goalfestBody: (p: Pair & Score & { goals: number; v: number }) =>
    pick(p.v, [
      `${p.home}${waGwa(p.home)} ${p.away}의 경기에서 ${p.goals}골이 터졌습니다. 최종 스코어는 ${p.score}입니다.`,
      `양 팀 공격수들이 쉬지 않고 골망을 흔들었습니다. 90분 동안 ${p.goals}골이 오간 끝에 ${p.score}로 끝났습니다.`,
      `관중석이 쉴 틈이 없었습니다. ${p.home}${waGwa(p.home)} ${p.away}${iGa(p.away)} 주고받은 골은 모두 ${p.goals}골, 스코어는 ${p.score}였습니다.`,
    ]),
  derbyHead: (p: { homeRank: number; awayRank: number; v: number }) => {
    const hi = Math.min(p.homeRank, p.awayRank);
    const lo = Math.max(p.homeRank, p.awayRank);
    return pick(p.v, [
      `${hi}위와 ${lo}위의 맞대결`,
      `순위표를 건 한판, ${hi}위 대 ${lo}위`,
      `승점 6점짜리 경기, ${hi}위와 ${lo}위가 만났다`,
    ]);
  },
  derbyWin: (p: Win & Score & { v: number }) =>
    pick(p.v, [
      `${p.winner}${iGa(p.winner)} ${withEulReul(p.loser)} ${p.score}로 누르고 순위 싸움에서 앞섰습니다.`,
      `바로 앞뒤 순위끼리 붙은 경기에서 ${p.winner}${iGa(p.winner)} 웃었습니다. ${p.score} 승리로 ${p.loser}와의 간격을 벌렸습니다.`,
    ]),
  derbyDraw: (p: Pair & Score & { v: number }) =>
    pick(p.v, [
      `${p.home}${waGwa(p.home)} ${p.away}는 ${p.score}로 비겼습니다. 순위 싸움은 다음 라운드로 넘어갑니다.`,
      `누구도 물러서지 않았습니다. ${p.score} 무승부로 두 팀은 승점 1점씩 나눠 가졌습니다.`,
    ]),
  teamOfRoundHead: (p: { team: string; margin: number; v: number }) =>
    pick(p.v, [
      `${p.team}, ${p.margin}골 차 완승`,
      `이 라운드의 팀은 ${p.team}`,
      `${p.team}, 압도적인 경기력으로 ${p.margin}골 차 대승`,
    ]),
  teamOfRoundBody: (p: Win & Score & { v: number }) =>
    pick(p.v, [
      `${p.winner}${iGa(p.winner)} ${withEulReul(p.loser)} ${p.score}로 크게 이겼습니다.`,
      `경기 내내 주도권은 ${p.winner} 쪽에 있었습니다. ${p.loser}${iGa(p.loser)} 손쓸 틈도 없이 ${p.score}로 무너졌습니다.`,
    ]),
  leaderNewHead: (p: { team: string; tier: number; v: number }) =>
    pick(p.v, [
      `${p.team}, ${p.tier}부 선두로`,
      `${p.tier}부 새 주인 ${p.team}`,
      `${p.team}, 마침내 정상에 서다`,
    ]),
  leaderKeepHead: (p: { team: string; v: number }) =>
    pick(p.v, [
      `${p.team}, 선두 자리 지켜`,
      `흔들림 없는 ${p.team}, 여전히 1위`,
      `${p.team}의 독주는 계속된다`,
    ]),
  leaderNewBody: (p: { team: string; tier: number; points: number }) =>
    `${p.team}${iGa(p.team)} 승점 ${p.points}점으로 ${p.tier}부 1위에 올랐습니다.`,
  leaderKeepBody: (p: { team: string; tier: number; points: number }) =>
    `${p.team}${iGa(p.team)} 승점 ${p.points}점으로 ${p.tier}부 1위를 지켰습니다.`,
  streakHead: (p: { team: string; n: number; v: number }) =>
    pick(p.v, [
      `${p.team}, ${p.n}연승 행진`,
      `멈추지 않는 ${p.team}, 벌써 ${p.n}연승`,
      `${p.team}의 상승세, 어느덧 ${p.n}연승`,
    ]),
  streakBody: (p: { team: string; n: number }) =>
    `${p.team}${iGa(p.team)} ${p.n}경기 연속 이겼습니다.`,
  comebackHead: (p: { team: string; n: number; v: number }) =>
    pick(p.v, [
      `${p.team}, ${p.n}골 차를 뒤집은 역전승`,
      `포기는 없었다, ${p.team}의 대역전극`,
      `끌려가던 ${p.team}, 경기를 뒤집다`,
    ]),
  comebackBody: (p: Win & Score & { n: number; v: number }) =>
    pick(p.v, [
      `${p.winner}${iGa(p.winner)} ${p.n}골 차로 끌려가다 ${withEulReul(p.loser)} ${p.score}로 꺾었습니다.`,
      `먼저 웃은 쪽은 ${p.loser}였습니다. 하지만 ${p.winner}${iGa(p.winner)} 차례로 골을 몰아넣으며 ${p.score} 역전승을 완성했습니다.`,
    ]),
  lateHead: (p: { team: string; minute: number; v: number }) =>
    pick(p.v, [
      `${p.minute}분의 기적, ${p.team} 극장골`,
      `${p.team}, 종료 직전 결승골`,
      `마지막에 웃은 건 ${p.team}`,
    ]),
  lateBody: (p: Win & Score & { minute: number; name: string; v: number }) =>
    pick(p.v, [
      `${p.minute}분 ${p.name}의 골이 승부를 갈랐습니다. ${p.winner}${iGa(p.winner)} ${withEulReul(p.loser)} ${p.score}로 꺾었습니다.`,
      `무승부로 끝나는 듯했던 경기는 ${p.minute}분에 뒤집혔습니다. ${p.name}${iGa(p.name)} 결승골을 넣었고 ${p.winner}${iGa(p.winner)} ${p.score}로 이겼습니다.`,
    ]),
  hattrickHead: (p: { name: string; team: string; goals: number; v: number }) =>
    pick(p.v, [
      `${p.name}, ${p.goals}골 원맨쇼`,
      `${p.team}의 ${p.name}, 해트트릭 폭발`,
      `혼자서 ${p.goals}골, ${p.name}의 날`,
    ]),
  hattrickBody: (p: { name: string; team: string; goals: number; score: string; v: number }) =>
    pick(p.v, [
      `${p.team}의 ${p.name}${iGa(p.name)} 한 경기에서 ${p.goals}골을 넣었습니다. 경기는 ${p.score}로 끝났습니다.`,
      `${p.name}${iGa(p.name)} 골문 앞에서 자비를 보이지 않았습니다. ${p.goals}골을 몰아친 활약으로 경기의 주인공이 됐습니다(${p.score}).`,
    ]),
  firstWinHead: (p: { team: string; n: number; v: number }) =>
    pick(p.v, [
      `${p.team}, ${p.n}경기 만에 시즌 첫 승`,
      `기다림 끝에 첫 승, ${p.team}`,
      `${p.team}, 마침내 승리를 맛보다`,
    ]),
  firstWinBody: (p: Win & Score & { n: number; v: number }) =>
    pick(p.v, [
      `${p.winner}${iGa(p.winner)} ${withEulReul(p.loser)} ${p.score}로 꺾고 ${p.n}경기 만에 첫 승을 올렸습니다.`,
      `이번 시즌 승리가 없던 ${p.winner}${iGa(p.winner)} 드디어 웃었습니다. ${p.score} 승리로 반등의 발판을 마련했습니다.`,
    ]),
  youth: '유스 선수',
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
