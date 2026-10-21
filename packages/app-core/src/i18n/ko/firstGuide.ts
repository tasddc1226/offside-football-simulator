// T-11-355 처음 안내 카드(웹 FirstGuide.svelte · 앱 screens/home/FirstGuide.tsx)와 상품 위치 안내
// (웹 ItemsHint.svelte · 앱 components/ItemsHint.tsx — 설정 · 선수 만들기 후보 단계). 한 번 닫으면 그 기기에서 다시 뜨지 않는다.
import { ns } from '../core';

const ko = {
  title: '처음 안내',
  close: '닫기',
  closeAria: '처음 안내 닫기',
  typesTitle: '포지션과 유형',
  typesBody: (p: { n: number }) =>
    `선수를 만들 때 고른 주력 능력치 ${p.n}개로 유형이 정해져요. 조합별 유형과 맞는 팀 시너지는 유형 도감에 있어요.`,
  typesGo: '유형 도감',
  shopTitle: '리롤권 · 스카우트권 · 강화권',
  shopBody:
    '내 구단 화면의 상점에서 사요. 리롤권과 스카우트권은 선수 만들기 후보 단계에서, 강화권은 선수 탭 잠재력 강화에서 써요.',
  shopGo: '상점 가기',
  guideTitle: '영구결번 · 은퇴',
  guideBody: '영구결번 조건, 은퇴 나이, 명예의 전당은 게임 가이드에 정리돼 있어요.',
  guideGo: '게임 가이드',
  itemsTitle: '스카우트권 · 강화권은 여기서',
  itemsBody:
    '리롤권 · 프리미엄 스카우트권 · 잠재력 강화권은 내 구단 화면의 상점에 있어요. 구단 자금으로 사는 상품은 웹과 앱에서, 결제 상품은 앱에서 사요.',
  itemsCloseAria: '상품 위치 안내 닫기',
  // T-11-437 첫 커리어 시작 뒤 한 번 · 저장 위치
  saveTitleWeb: '기록은 이 브라우저에만 저장돼요',
  saveTitleApp: '기록은 이 기기에만 저장돼요',
  saveBodyWeb:
    '다른 브라우저나 기기로 옮기면 진행 중인 커리어가 따라가지 않아요. 옮기기 전에 설정에서 백업 코드를 만들면 거기서 이어 할 수 있어요.',
  saveBodyApp:
    '앱을 지우거나 기기를 바꾸면 진행 중인 커리어가 따라가지 않아요. 옮기기 전에 설정에서 백업 코드를 만들면 거기서 이어 할 수 있어요.',
  saveGo: '백업 코드 만들기',
  saveCloseAria: '저장 위치 안내 닫기',
  typeDex: '선수 유형 도감',
};
export type FirstGuideMsgs = typeof ko;
export const firstGuideText = ns('firstGuide', ko);
