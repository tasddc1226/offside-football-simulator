// home 네임스페이스에서 나눈 부분(T-11-102, 웹 첫 화면 청크를 작게).
import { ns } from '../core';

const ko = {
  dexSubApp: '선택지마다 성공 확률 공개 · 확률 도감 보기 →',
  galleryWideTitle: '오프사이드 마이너 갤러리 ↗',
  galleryWideSub: '디시인사이드에서 커리어 자랑 · 공략 · 건의 나누기',
  chatLabelApp: '라운지 채팅',
  // 알림 권유 카드(앱)
  pushTitle: '새 소식을 알림으로 받아볼까요?',
  pushBody:
    '공지·릴리즈 노트의 새 글을 알려 드려요. 게시판마다 하루 한 번 보내요. 설정에서 언제든 끌 수 있어요.',
  pushBusy: '알림 연결 중…',
  pushAccept: '알림 받기',
  pushLater: '나중에',
  pushPrivacy: '알림 정보 처리 안내',
};

export type HomeMoreMsgs = typeof ko;
export const homeMoreText = ns('homeMore', ko);
