// T-11-423 제휴 홈 팝업(아마축구). 한국어로 쓰는 사람에게만 띄우지만 사전은 세 언어를 맞춘다.
import { ns } from '../core';

const ko = {
  aria: '제휴 서비스 아마축구 소개',
  badge: '제휴',
  altA: '아마축구: 흩어진 운영, 이제 한 곳에서. 선수단 · 일정 투표 · 회비 · 기록 · 매칭 · 용병',
  altB: '아마축구: 매 경기의 기록이 팀의 자산이 되도록. 득점 · 도움 · 출전 기록까지 자동으로',
  open: '아마축구 보러 가기',
  hideToday: '오늘 하루 보지 않기',
  close: '닫기',
};

export type PartnerMsgs = typeof ko;
export const partnerText = ns('partner', ko);
