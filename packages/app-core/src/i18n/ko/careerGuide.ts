import { ns } from '../core';
const ko = {
  candidateNote:
    '후보 카드의 능력치는 기본 분포예요. 킥오프 때 세부 능력치와 체격을 반영해 다시 계산하므로, 시작 능력치는 달라질 수 있어요.',
  trainWeak: '약점 집중훈련은 아래 자기 투자에서 고를 수 있어요.',
  guideTitle: '포지션 육성 안내',
  guideNote:
    '유형은 선수 생성 때 고른 주력 조합으로 정해져요. 능력치를 올려도 유형이 바뀌지는 않아요.',
  focusLabel: '추천 주력',
  nameRule: (p: { field: string; min: number; max: number }) =>
    `${p.field}은 ${p.min}~${p.max}자로 입력해 주세요.`,
  wallTitle: '구단의 명예의 벽에 이름을 남겼습니다.',
  occupied: (p: { number: number; holder: string }) =>
    `${p.number}번은 ${p.holder}의 영구결번으로 남아 있습니다.`,
  wallRule: '영구결번은 구단·등번호별 경쟁 기록으로 따로 남아요.',
};
export type CareerGuideMsgs = typeof ko;
export const careerGuideText = ns('careerGuide', ko);
