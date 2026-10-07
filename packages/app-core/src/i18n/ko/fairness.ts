// 확률 도감의 '확률과 공정성' 문구(웹 EventDex.svelte · 앱 screens/hof/Dex.tsx · app-core fairness.ts).
import { ns } from '../core';

const ko = {
  title: '확률과 공정성',
  intro:
    '모든 유저에게 같은 규칙과 같은 확률을 써요. 아래 숫자는 게임 코드의 값에서 바로 계산해요.',
  promiseSameTerm: '같은 규칙',
  promiseSame:
    '광고 시청, 광고 제거 구매, 계정 연결, 언어 설정은 확률과 결과에 영향을 주지 않아요.',
  promiseDeviceTerm: '기기에서 판정',
  promiseDevice:
    '커리어의 판정은 모두 이 기기에서 이루어져요. 서버는 결과를 정하지 않고 기록만 받아요.',
  promiseShownTerm: '보이는 확률이 실제 확률',
  promiseShown:
    '선택지에 보이는 퍼센트가 실제 성공 확률이에요. 타이밍 게이지 선택지만 바늘을 멈춘 위치로 판정해요.',
  promiseVersionTerm: '조정은 버전으로',
  promiseVersion:
    '운영 중 수치를 바꾸면 모든 유저에게 같은 값을 버전을 붙여 적용해요. 진행 중인 커리어는 다음 시즌부터 바뀌어요.',
  potTitle: '잠재력 등급 확률',
  potNote:
    '새 선수의 실제 잠재력은 이 확률로 정해져요. 광고로 등급 범위를 봐도 결과는 바뀌지 않아요.',
  gradeHead: '등급',
  colSeason: '시즌 중 시작',
  colPre: '프리시즌 시작',
  atLeastOne: (p: { grade: string; season: string; pre: string }) =>
    `후보 3명 중 ${p.grade} 등급이 1명 이상 나올 확률은 시즌 중 ${p.season}, 프리시즌 ${p.pre}예요.`,
  boostTitle: '잠재력 강화 확률',
  boostLv: (p: { lv: number }) => `+${p.lv} 단계`,
  boostNote: (p: { pity: string }) =>
    `같은 단계에서 실패할 때마다 다음 시도 확률이 ${p.pity}씩 올라요. 광고로 시도해도 확률은 같아요.`,
  hiddenTitle: '숨겨 둔 것과 이유',
  hiddenPotTerm: '실제 잠재력',
  hiddenPot: '은퇴할 때 공개해요. 스카우트 평가는 실제 값과 조금 다를 수 있어요.',
  hiddenBloomTerm: '늦게 피는 선수',
  hiddenBloom:
    '실제 잠재력은 25세까지 조금씩 오르내리고, 21세와 24세 재평가 때 반영돼요. 모든 선수에게 같은 규칙이에요.',
  hiddenStoryTerm: '스토리·특별 이벤트',
  hiddenStory: '스포일러를 막으려고 한 번 겪어야 도감에 열려요. 확률 규칙은 다른 이벤트와 같아요.',
  historyTitle: '밸런스 변경 이력',
  historyLoading: '이력을 불러오는 중…',
  historyError: '이력을 불러오지 못했어요.',
  historyEmpty: '아직 바뀐 적이 없어요. 모든 커리어가 기본 밸런스로 진행돼요.',
  historyVersion: (p: { v: number; day: string }) => `버전 ${p.v} · ${p.day}`,
  historyActive: '지금 적용 중',
  historySame: '바뀐 항목이 없어요.',
  historyNote: '항목 이름 옆은 바로 앞 버전 값에서 바뀐 값이에요. 날짜는 한국 시간 기준이에요.',
  version: (p: { v: number }) =>
    p.v
      ? `지금 새 커리어에는 밸런스 버전 ${p.v}이 적용돼요.`
      : '지금 새 커리어에는 기본 밸런스(버전 0)가 적용돼요.',
};

export type FairnessMsgs = typeof ko;
export const fairnessText = ns('fairness', ko);
