// home 네임스페이스에서 나눈 부분(T-11-102, 웹 첫 화면 청크를 작게).
import { ns } from '../core';

const ko = {
  chatLabelApp: '라운지 채팅',
  // 알림 권유 카드(앱)
  pushTitle: '컵 접수와 경기 결과를 알림으로 받을까요?',
  pushBody:
    '오프사이드 컵 접수는 며칠만 열려요. 접수가 열리면 바로 알려 드리고, 컵 결과 · 내 팀 경기 결과 · 등록한 선수 판매 · 친구 신청도 알려 드려요. 종류마다 설정에서 끌 수 있어요.',
  pushBusy: '알림 연결 중…',
  pushAccept: '알림 받기',
  pushLater: '나중에',
  pushPrivacy: '알림 정보 처리 안내',
};

export type HomeMoreMsgs = typeof ko;
export const homeMoreText = ns('homeMore', ko);
