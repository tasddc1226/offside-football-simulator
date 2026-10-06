// 앱 틀: 상단 브랜드·하단 메뉴·알림 배너·푸터·불러오기 상태·광고 칸·시트 공통 문구(웹 ui/* · 앱 ui/*·banners/*·components/*).
// 웹·앱 문구가 다른 줄은 Web/App 접미사로 나눈다.
import { ns } from '../core';

const ko = {
  brandTag: '풀타임: 휘슬이 울릴 때까지',
  brandName: '오프사이드',
  navLabel: '메인 메뉴',
  navHof: '기록실',
  navBoard: '소식',
  navHome: '홈',
  navOwner: '구단주',
  navSettings: '설정',
  achNew: (p: { n: number }) => `새 업적 ${p.n}개`,
  recapNew: '새 시즌 결산',
  bgm: '배경음악',
  bgmOff: '배경음악 끄기',
  bgmOn: '배경음악 켜기',
  loading: '불러오는 중…',
  bannerClose: '알림 닫기',
  newsAlert: '새 소식 알림',
  newsView: '보기',
  newsCount: (p: { n: number }) => `새 소식 ${p.n}개가 올라왔어요`,
  newsReleaseEdited: '릴리즈 노트가 수정됐어요',
  newsNoticeEdited: '공지가 수정됐어요',
  newsReleaseNew: '새 릴리즈 노트가 올라왔어요',
  newsNoticeNew: '새로운 공지가 올라왔어요',
  updateAlert: '업데이트 알림',
  updateBodyWeb: '새 버전이 나왔어요. 새로고침하면 바로 적용돼요.',
  updateBtnWeb: '새로고침',
  footContact: '문의',
  footCommunity: '커뮤니티',
  footGallery: '디시 오프사이드 마이너 갤러리',
  // 경기 구간 시트(app-core sheets.ts · sheet-controller.ts)
  resWin: '승',
  resDraw: '무',
  resLoss: '패',
  marketLabel: '다음 시즌, 어디서 뛸까요?',
  opponent: '상대 팀',
  confirm: '확인',
  kickoff: '킥오프',
  // 저장 공간 부족(웹 ui/helpers.ts)
  storageFull: '저장 공간이 부족해 진행 상황을 저장하지 못했어요. 설정에서 백업해 두세요.',
};

export type ShellMsgs = typeof ko;
export const shellText = ns('shell', ko);
