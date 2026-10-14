import { ns } from '../core';
const ko = {
  title: '원본 PNG를 게임 화면에서 보기',
  intro: '도트 변환이나 얼굴 재조립 없이 원본 이미지를 그대로 표시해요',
  note: '로컬 외형 미리보기예요 · 머리·피부·유니폼 색은 원본에 고정되어 있으며 선수 기록과 저장된 꾸미기 값은 바뀌지 않아요',
  artwork: '외형 선택',
  bald: '완전 민머리',
  shaved: '짧은 삭발',
  dread: '드레드',
  fauxhawk: '스파이크 모히칸',
  ponytail: '포니테일',
  mullet: '투톤 꽁지머리',
  keeper: '키퍼 용품',
  theme: '밝게 / 어둡게',
  character: '캐릭터',
  originalSize: '원본 PNG · 144px',
  gameSize: '게임 크기 · 72px',
  careerSize: '커리어 화면 크기',
  cards: '선수 카드',
  cardIntro: '실제 선수 카드 컴포넌트에 같은 PNG의 얼굴과 어깨를 표시해요',
  poses: '원본 자세',
  poseAria: '자세 선택',
  standing: '서기',
  running: '달리기',
  shooting: '슈팅',
  poseNote: '원본의 3자세를 표시해요 · 전체 모션 애니메이션은 아직 연결하지 않았어요',
  openSource: '원본 PNG 보기',
  openGame: 'PNG 미리보기로 로컬 게임 열기',
  footer:
    '로컬 게임 링크는 이 탭의 캐릭터와 카드 그림만 바꿔요 · 모든 선수에게 선택한 시안이 표시되며 커리어별 저장·색 변경은 아직 연결하지 않았어요 · 운영 환경과 모바일 앱은 그대로예요',
};
export type AvatarPngReviewMsgs = typeof ko;
export const avatarPngReviewText = ns('avatarPngReview', ko);
