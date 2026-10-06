// 홈 화면(웹 Home.svelte · HomeNews · HomeFirsts · HomeTicker · VoluntarySupport, 앱 screens/home/*). 웹·앱 문구가 다른 줄은 Web/App 접미사로 나눈다.
import { ns } from '../core';
import { withRo } from '../../format.js';

const ko = {
  // 진행 중인 커리어 카드
  currentSub: '진행 중인 커리어',
  currentLine: (p: { club: string; age: number; pos: string }) =>
    `${p.club} · ${p.age}세 · ${p.pos}`,
  currentMeta: (p: { year: number; phase: string; ovr: number }) =>
    `${p.year} 시즌 ${p.phase} · OVR ${p.ovr}`,
  newCareer: '새 커리어 시작',
  continueCareer: (p: { name: string }) => `${withRo(p.name)} 계속 →`,
  // 첫 방문 카드 (제목은 세 줄 — 웹은 <br />, 앱은 줄바꿈으로 잇는다)
  kickoffLine1: '이번 생은 축구다',
  kickoffLine2: '고3부터 은퇴까지,',
  kickoffLine3: '한 선수로 살아요',
  kickoffSub: '훈련·이적·이벤트에서 고른 선택으로 커리어가 달라져요.',
  kickoffBtn: '새 커리어 킥오프 →',
  // 다른 계정에 기록된 커리어
  conflictTitle: '이 커리어는 다른 계정에 기록돼 있어요',
  conflictBody: (p: { name: string }) =>
    `로그인한 계정이 바뀌어서 ${p.name} 선수의 기록이 서버에 저장되지 않고 있어요. 원래 계정으로 다시 로그인하면 그대로 이어져요.`,
  conflictAdopt: '지금 계정으로 이어서 기록',
  conflictKeep: '이 기기에만 두기',
  // 타일
  marketTitle: '이적시장',
  marketSub: '이번 시즌 선수 사고팔기 · 시세 →',
  dexTitle: '확률 이벤트',
  dexSubWeb: '선택지별 성공 확률 보기 →',
  testerTitle: '테스터 모집 ↗',
  testerSub: '안드로이드 앱 비공개 테스트 신청하기',
  galleryTitle: '마이너 갤러리 ↗',
  gallerySub: '디시인사이드에서 커리어 자랑 · 공략 · 건의',
  firstsTitle: '서버 최초 기록',
  firstsCount: (p: { done: number; total: number }) => `서버 최초 업적 ${p.done} / ${p.total}`,
  firstsEmpty: '모든 플레이어 중 첫 기록 보기',
  // 채팅 버튼
  chatLabel: '채팅',
  chatLabelUnread: (p: { n: number }) => `채팅, 읽지 않은 메시지 ${p.n}개`,
  chatStatusUnread: (p: { n: number }) => `읽지 않은 채팅 메시지 ${p.n}개`,
  // 소식 섹션
  noticeTitle: '공지사항',
  releaseTitle: '릴리즈 노트',
  newsAll: '전체 보기',
  newsFailed: '소식을 불러오지 못했어요.',
  newsEmpty: '아직 올라온 글이 없어요.',
  pinned: '고정',
  // 전광판
  tagTransfer: '이적',
  tagDebut: '프로 입단',
  tagFirst: '서버 최초',
  tagRecord: '서버 신기록',
  tickerAria: '이적·서버 기록 소식',
  tickerIdle: '이적 소식과 서버 최초 기록이 여기로 흘러요',
  tickerAge: (p: { age: number }) => `(${p.age}세)`,
  // 개발자 응원
  supportTitle: '개발자 응원하기',
  supportBody:
    '재밌게 즐기셨다면 개발을 응원해 주세요. 후원은 선택이며, 게임 혜택이나 광고 제거는 제공하지 않아요.',
  supportCopy: '후원 계좌 복사',
  supportCopied: '계좌번호를 복사했어요. 고마워요',
  supportCopyFailed: '복사하지 못했어요. 아래 계좌번호를 직접 적어 주세요',
};

export type HomeMsgs = typeof ko;
export const homeText = ns('home', ko);
