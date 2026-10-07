// 확률 도감 문구(웹 EventDex.svelte · 앱 screens/hof/Dex.tsx · app-core dexText.ts). 이벤트 제목·선택지·영향 요인 이름은 게임이 만든 문구라 옮기지 않는다.
import { ns } from '../core';

const ko = {
  title: '확률 도감',
  intro: '선수 상태에 따라 성공 확률이 달라져요. 가능한 범위와 영향 요인을 보여 줘요.',
  rulesTitle: '공통 규칙',
  calculating: '확률을 계산하는 중…',
  events: '이벤트',
  foundCount: (p: { n: number; total: number }) => `발견 ${p.n}/${p.total}`,
  groupLabel: '분류',
  filterAll: '전체',
  foundMark: '발견',
  lockedStory: (p: { stage: number | string }) => `아직 만나지 못한 스토리 이벤트 · ${p.stage}단계`,
  lockedSpecial: '아직 만나지 못한 특별 이벤트',
  dependsOnPast: '앞 단계에서 한 선택에 따라 확률이 달라져요.',
  noteWeb:
    '▲는 값이 클수록 성공 확률이 오르고, ▼는 내려가요. 범위는 선수 상태에 따라 나올 수 있는 최저~최고 확률이에요.',
  noteApp:
    '▲는 값이 클수록 성공 확률이 오르고, ▼는 내려가요. 범위는 가능한 선수 상태 전체에서 나올 수 있는 최저~최고예요.',
  // 선택지 오른쪽 표기
  oddsSafe: '안전',
  oddsSure: '확정',
  oddsVaries: '상황별',
  oddsMinigame: (p: { range: string }) => `원터치 · 구간 ${p.range}%`,
  // 공통 규칙(용어 · 설명)
  ruleRateTerm: '이벤트가 생길 확률',
  ruleRate: (p: { pre: string; season: string }) =>
    `구간마다 프리시즌 ${p.pre}, 전반기·후반기 ${p.season}. 스토리의 다음 단계는 예정된 때에 따로 찾아와요.`,
  ruleSameTerm: '같은 이벤트',
  ruleSame: (p: { n: number }) =>
    `한 번 나온 이벤트는 최소 ${p.n}구간 동안 다시 나오지 않고, 볼수록 덜 나와요(가중치 1/(1+본 횟수)).`,
  ruleRollTerm: '성공 판정',
  ruleRoll:
    '선택 창에 뜨는 %가 실제 판정 확률이에요. 0~100 사이 무작위 수가 그보다 작으면 성공이에요. 숨은 보정은 없고, 광고·결제·계정과 관계없이 모든 유저에게 같은 규칙이에요.',
  ruleMiniTerm: '원터치 미니게임',
  ruleMini:
    '페널티킥·1대1·승부차기처럼 경기 장면이 있는 선택은 확률 대신 타이밍으로 가려요. 게이지 위를 오가는 바늘을 초록 구간에서 멈추면 성공이에요. 3초 안에 누르지 않으면 실패예요. 구간 넓이는 능력치로 정해지고, 도감에는 게이지 대비 구간 넓이를 적어요. 감속 모션을 켜 두면 표시된 확률로 판정해요.',
  ruleSafeTerm: '안전한 선택',
  ruleSafe: (p: { span: string; twist: string; cost: string }) =>
    `판정 없이 확정되지만 좋은 효과가 ${p.span}로 줄고, ${p.twist} 확률로 대가를 치러요(${p.cost} 중 하나).`,
  ruleResultTerm: '결과 수치',
  ruleResult: (p: { span: string }) => `그 밖의 효과는 표시된 크기의 ${p.span} 사이에서 정해져요.`,
  ruleTwistTerm: '뜻밖의 반전',
  ruleTwist: (p: { twist: string; ok: string; fail: string; safe: string }) =>
    `대가가 없었다면 ${p.twist} 확률로 능력치 하나가 바뀌어요. 오를 확률은 성공·확정 ${p.ok}, 실패 ${p.fail}, 안전한 선택 ${p.safe}예요. 오르면 +1~2, 내리면 −1이에요.`,
};

export type DexMsgs = typeof ko;
export const dexText = ns('dex', ko);
