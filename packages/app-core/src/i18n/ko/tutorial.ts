// T-11-473 처음 온 기기의 첫 커리어 따라가기 안내(웹 Coachmark.svelte · 앱 components/Coachmark.tsx, 단계는 app-core tutorial).
import { ns } from '../core';

const ko = {
  step: (p: { n: number; total: number }) => `${p.n} / ${p.total}`,
  skip: '건너뛰기',
  next: '다음',
  done: '알겠어요',
  tapHint: '비춘 곳을 눌러요',
  label: '첫 커리어 안내',
  newTitle: '첫 선수를 만들어요',
  newBody: '고3부터 은퇴까지 한 선수의 커리어를 따라가요. 여기를 눌러 시작해요.',
  posTitle: '포지션을 골라요',
  posBody: '포지션마다 중요한 능력치와 쌓이는 기록이 달라요.',
  focusTitle: (p: { n: number }) => `주력 능력치 ${p.n}개를 골라요`,
  focusBody: '고른 조합으로 선수 유형이 정해지고, 처음 능력치도 그쪽으로 쏠려요.',
  candidatesTitle: '후보를 봐요',
  candidatesBody: '주력 능력치를 다 골랐으면 이 버튼을 눌러요.',
  candsTitle: '세 후보 중 한 명을 골라요',
  candsBody:
    '능력치 총합은 같고 분포와 잠재력이 달라요. 리롤권으로 다시 뽑고, 프리미엄 스카우트권으로 더 좋은 후보를 찾을 수 있어요.',
  startTitle: '커리어를 시작해요',
  startBody: '고른 후보로 첫 시즌에 들어가요.',
  goTitle: '시즌을 진행해요',
  goBody: '누를 때마다 시즌이 한 단계씩 흘러가요. 훈련과 자기 투자는 위 카드에서 바꿔요.',
  choiceTitle: '이벤트가 왔어요',
  choiceBody: '하나를 골라요. 고른 답에 따라 능력치와 인기가 달라져요.',
  seasonTitle: '첫 시즌이 끝났어요',
  seasonBody: '한 해 기록이 여기 정리돼요. 성장한 능력치는 선수 탭에서 봐요.',
  retireTitle: '은퇴하면 명예의 전당에 올라요',
  retireBody: '기록 · 트로피 · 개인상이 쌓일수록 레전드 점수가 올라가요. 이제 커리어를 이어 가요.',
  replay: '튜토리얼 다시 보기',
};
export type TutorialMsgs = typeof ko;
export const tutorialText = ns('tutorial', ko);
