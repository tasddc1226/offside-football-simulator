// 선수 탭 문구(웹 tabs/PlayerTab.svelte · 앱 screens/game/PlayerTab.tsx). 잠재력 강화는 gameBoost, 잠재력 안내는 gamePotential이다.
// 병역·국적·특성 이름과 안내 문장은 게임이 만든 문구라 옮기지 않는다.
import { ns } from '../core';

const ko = {
  profile: '선수 정보',
  nation: '국적',
  body: '체격',
  foot: '주발',
  trait: '성장 특성',
  potential: '잠재력 평가',
  peakOvr: '최고 OVR',
  trust: '감독 신뢰',
  trustHigh: '두터움',
  trustMid: '보통',
  trustLow: '냉랭함',
  contract: '계약',
  contractLeft: (p: { years: number; salary: string }) => `${p.years}년 남음 · ${p.salary}/년`,
  amateur: '아마추어',
  money: '보유 자금',
  value: '추정 몸값',
  nationalTitle: '국가대표',
  caps: 'A매치',
  goals: '골',
  assists: '도움',
  captain: '주장',
  debut: 'A매치 데뷔',
  notCalled: '미발탁',
  military: '병역',
  nextWc: '다음 월드컵',
  hostTbd: '개최지 미정',
  tourLine: (p: { stage: string; apps: number; goals: number }) =>
    `${p.stage} · ${p.apps}경기 ${p.goals}골`,
  retire: '은퇴 선언하기',
};

export type GamePlayerMsgs = typeof ko;
export const gamePlayerText = ns('gamePlayer', ko);
