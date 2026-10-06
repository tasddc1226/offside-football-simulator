// 팀 경기 문자중계(app-core teamLive 대본 · 웹 TeamLive.svelte · 앱 TeamLive.tsx). 대본 문구는 경기 id를 시드로 고르므로
// 줄 수(chance1~5 …)는 언어마다 같아야 한다 — 같은 경기는 어느 언어로 봐도 같은 순서로 나온다.
import { iGa, waGwa } from '../../format.js';
import { ns } from '../core';

const ko = {
  kickoff: (p: { home: string; away: string }) =>
    `${p.home}${waGwa(p.home)} ${p.away}의 경기, 주심의 휘슬과 함께 킥오프!`,
  chance1: (p: { t: string }) => `${p.t}, 오른쪽 측면을 파고들어 크로스를 올립니다.`,
  chance2: (p: { t: string }) => `${p.t}의 빠른 역습! 수비 숫자가 모자랍니다.`,
  chance3: (p: { t: string }) => `${p.t}, 중원에서 공을 끊어 내고 전진합니다.`,
  chance4: (p: { t: string }) => `${p.t}${iGa(p.t)} 짧은 패스로 상대 진영을 흔듭니다.`,
  chance5: (p: { t: string }) => `${p.t}, 왼쪽 측면에서 일대일 돌파를 시도합니다.`,
  save1: (p: { t: string }) => `${p.t}의 강한 중거리 슛! 골키퍼가 몸을 날려 쳐 냅니다.`,
  save2: (p: { t: string }) => `${p.t}, 골문 앞 헤더! 골키퍼 정면으로 향합니다.`,
  save3: (p: { t: string }) => `${p.t}의 낮게 깔린 슈팅, 골키퍼가 발끝으로 막아 냅니다!`,
  miss1: (p: { t: string }) => `${p.t}, 회심의 슈팅이 골대를 살짝 벗어납니다.`,
  miss2: (p: { t: string }) => `${p.t}, 결정적인 기회였는데 크로스바를 넘기고 맙니다!`,
  miss3: (p: { t: string }) => `${p.t}의 슛이 골대를 맞고 나옵니다! 아쉬움에 머리를 감싸 쥡니다.`,
  corner1: (p: { t: string }) => `${p.t}, 코너킥을 얻어 냅니다.`,
  corner2: (p: { t: string }) => `${p.t}의 프리킥, 수비벽에 막힙니다.`,
  build1: (p: { t: string }) => `${p.t}, 페널티 박스 안으로 파고듭니다…!`,
  build2: (p: { t: string }) => `${p.t}의 날카로운 침투 패스가 수비 뒷공간으로!`,
  build3: (p: { t: string }) => `${p.t}, 문전 혼전 상황입니다…!`,
  goal: (p: { t: string; scorer: string }) => `골! ${p.t} ${p.scorer}!`,
  goalAssist: (p: { assist: string }) => ` ${p.assist}의 도움.`,
  flavorHat: ' 해트트릭 완성!',
  flavorLateEq: ' 극적인 동점골!',
  flavorLateWin: ' 경기를 뒤집는 극장골!',
  flavorEq: ' 균형을 되찾습니다!',
  flavorLead: ' 역전입니다!',
  halfTime: (p: { home: string; away: string; hs: number; as: number }) =>
    `전반 종료. ${p.home} ${p.hs} : ${p.as} ${p.away}`,
  fullTime: (p: { home: string; away: string; h: number; a: number; result: string }) =>
    `경기 종료! ${p.home} ${p.h} : ${p.a} ${p.away}. ${p.result}`,
  resultWin: '승리를 거둡니다!',
  resultLoss: '아쉬운 패배입니다.',
  resultDraw: '승부를 가리지 못했습니다.',
  // 단계 이름
  phase1st: '전반',
  phaseHt: '하프타임',
  phase2nd: '후반',
  phaseFt: '경기 종료',
  // 화면
  title: (p: { home: string; away: string }) => `${p.home} 대 ${p.away} 문자중계`,
  scoreAria: (p: { a: number; b: number }) => `${p.a} 대 ${p.b}`,
  flow: '흐름',
  speedNormal: '보통 속도',
  speedFast: '빠르게',
  skip: '결과 바로 보기',
};

export type TeamLiveMsgs = typeof ko;
export const teamLiveText = ns('teamLive', ko);
