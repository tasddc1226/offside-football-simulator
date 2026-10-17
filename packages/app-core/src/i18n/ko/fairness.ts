// 확률 도감의 '확률과 공정성' 문구(웹 EventDex.svelte · 앱 screens/hof/Dex.tsx · app-core fairness.ts).
import { ns } from '../core';
import { iGa } from '../../format';

const ko = {
  title: '확률과 공정성',
  intro:
    '같은 조건이면 모든 유저에게 같은 규칙과 같은 확률을 써요. 아래 숫자는 게임 코드의 값에서 바로 계산해요.',
  promiseSameTerm: '같은 규칙',
  promiseSame:
    '광고 시청, 광고 제거 구매, 계정 연결, 언어 설정은 확률에 영향을 주지 않아요. 광고나 구단 자금으로 예산이 모자란 시즌에 잠재력 강화를 더 시도할 수는 있지만, 성공 확률은 같아요. 확률을 바꾸는 유료 아이템은 프리미엄 스카우트권 하나이고, 바뀐 확률은 아래에 모두 공개해요.',
  promiseDeviceTerm: '기기에서 판정',
  promiseDevice:
    '커리어의 판정은 모두 이 기기에서 이루어져요. 서버는 결과를 정하지 않고 기록만 받아요.',
  promiseShownTerm: '보이는 확률이 실제 확률',
  promiseShown:
    '선택지에 보이는 퍼센트가 실제 성공 확률이에요. 타이밍 게이지 선택지만 바늘을 멈춘 위치로 판정해요.',
  promiseVersionTerm: '조정은 버전으로',
  promiseVersion:
    '운영 중 수치를 바꾸면 모든 유저에게 같은 값을 버전으로 적용해요. 진행 중인 커리어는 다음 시즌부터 바뀌어요.',
  potTitle: '잠재력 등급 확률',
  potNote:
    '새 선수의 실제 잠재력은 이 확률로 정해져요. 광고로 등급 범위를 봐도 결과는 바뀌지 않아요.',
  gradeHead: '등급',
  colSeason: '시즌 중 시작',
  colPre: '프리시즌 시작',
  atLeastOne: (p: { grade: string; season: string; pre: string }) =>
    `후보 3명 중 ${p.grade} 등급이 1명 이상 나올 확률은 시즌 중 ${p.season}, 프리시즌 ${p.pre}예요.`,
  premium: (p: { season: string; pre: string }) =>
    `프리미엄 스카우트권으로 뽑으면 후보 3명 중 1명은 A 이상이 보장돼요. 모든 후보의 S 확률은 일반의 2배라 시즌 중 ${p.season}, 프리시즌 ${p.pre}예요. 나머지 후보의 A~D는 위 표의 비율을 그대로 따라요.`,
  premiumPity:
    '천장: 프리미엄 스카우트권을 S 후보 없이 29장 쓰면 30장째 보장 후보는 S로 확정돼요. 누적 100장째마다 보장 후보의 잠재력은 최고치(96)로 확정돼요. 남은 장수는 후보 선택 화면에서 볼 수 있어요.',
  rerollMileage: (p: { need: number }) =>
    `리롤권은 후보의 잠재력 확률을 바꾸지 않아요. 대신 리롤권을 ${p.need}장 쓸 때마다 프리미엄 스카우트권 1장을 받아요. 광고로 다시 뽑기는 세지 않아요.`,
  boostTitle: '잠재력 강화 확률',
  boostLv: (p: { lv: number }) => `+${p.lv} 단계`,
  boostNote: (p: { pity: string }) =>
    `같은 단계에서 실패할 때마다 다음 시도 확률이 ${p.pity}씩 올라요. 광고나 구단 자금으로 시도해도 확률은 같아요.`,
  enhanceTitle: '카드 강화 확률',
  enhanceColTry: '도전',
  enhanceColRate: '첫 시도 확률',
  enhanceColCost: '비용',
  enhanceColFail: '실패하면',
  enhanceTry: (p: { from: number; to: number }) => `+${p.from} → +${p.to}`,
  enhanceStay: '그대로',
  enhanceDrop: (p: { lv: number }) => `+${p.lv} 단계로`,
  enhanceNote: (p: { pity: string }) =>
    `구단주의 은퇴 선수 카드를 구단 자금으로 강화해요. 같은 카드가 연속으로 실패할 때마다 다음 시도 확률이 기본의 ${p.pity}씩 오르고, 성공하면 처음 확률로 돌아가요. 카드 강화는 구단주 기능이라 판정은 서버에서 해요.`,
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
  historyNote:
    '항목 이름 옆은 바로 앞 버전 값에서 바뀐 값이에요. 코드 업데이트 패치는 산식·규칙을 고친 배포예요. 날짜는 한국 시간 기준이에요.',
  historyPatch: '코드 업데이트',
  historyPatchDay: (p: { day: string }) => `${p.day} 적용`,
  historyOpenNote: '업데이트 소식에서 보기',
  version: (p: { v: number }) =>
    p.v
      ? `지금 새 커리어에는 밸런스 버전 ${p.v}${iGa(String(p.v))} 적용돼요.`
      : '지금 새 커리어에는 기본 밸런스(버전 0)가 적용돼요.',
};

export type FairnessMsgs = typeof ko;
export const fairnessText = ns('fairness', ko);
