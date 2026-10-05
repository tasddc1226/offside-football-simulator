// shell 네임스페이스에서 나눈 부분(T-11-102, 웹 첫 화면 청크를 작게).
import { ns } from '../core';

const ko = {
  navIntroGame: '게임 메뉴예요. 가운데 홈 버튼으로 나가요.',
  navIntroTeam: '내 팀 메뉴예요. 가운데 구단주 버튼으로 나가요.',
  back: '← 이전으로',
  close: '닫기',
  retry: '다시 시도',
  adLabel: '광고',
  adPreview: (p: { place: string }) => `광고 자리 · ${p.place}`,
  updateBodyApp: '새 버전이 나왔어요. 다시 시작하면 바로 적용돼요.',
  updateBtnApp: '다시 시작',
  storeUpdateAlert: '앱 업데이트 알림',
  storeUpdateTitle: '새 버전이 스토어에 나왔어요',
  storeUpdateBody: '업데이트하지 않으면 이후 수정이 이 앱에 들어가지 않아요.',
  storeUpdateBtn: '업데이트',
  keepLoginTitle: '로그인하고 기록 지키기',
  keepLoginBody:
    '로그인하면 은퇴 기록을 다른 기기에서도 볼 수 있어요. 공유 링크는 로그인 없이 만들어요.',
  keepLoginGoogle: '구글로 로그인',
  // 앱 스토어 열기 실패(앱 platform/review.ts)
  storeUnavailable: '이 기기에서는 스토어를 열 수 없어요.',
};

export type ShellMoreMsgs = typeof ko;
export const shellMoreText = ns('shellMore', ko);
