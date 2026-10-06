// 계정 영역(웹 Account.svelte · 앱 screens/owner/Account.tsx · LoginButtons.tsx · platform/auth.ts)과 계정 카드 제목(account.ts).
// 웹·앱 문구가 다른 줄은 Web/App 접미사로 나눈다.
import { ns } from '../core';

const ko = {
  title: '계정',
  checking: '확인 중…',
  errorTitle: '연결할 수 없어요',
  errorBody:
    '서버에 연결하지 못해 로그인 상태를 확인할 수 없어요. 게임은 계속할 수 있고, 진행 상황은 이 기기에 저장돼요.',
  retry: '다시 시도',
  guestTitle: '로그인하지 않았어요',
  guestBody:
    '게임 진행은 이 기기에만 저장돼요. 로그인하면 선수 기록과 구단 이름을 다른 기기에서도 볼 수 있어요.',
  logout: '로그아웃',
  cancel: '취소',
  logoutTitle: '로그아웃할까요?',
  logoutBodyWeb:
    '이 기기에 저장된 게임 진행은 그대로 남아요. 같은 구글 계정으로 다시 로그인하면 계정에 저장된 기록을 다시 볼 수 있어요.',
  logoutBodyApp:
    '이 기기에 저장된 게임 진행은 그대로 남아요. 같은 계정으로 다시 로그인하면 저장된 기록을 볼 수 있어요.',
  nickname: '댓글 닉네임',
  nicknamePrompt: '댓글 닉네임을 정하면 소식 게시판에 댓글을 쓸 수 있어요',
  nicknameFixed: (p: { nickname: string | null }) => `${p.nickname} · 운영자 계정은 고정이에요`,
  unlinkGoogle: '구글 연동 해제',
  deleteAccount: '계정 삭제',
  deleteBody:
    '계정과 서버에 저장된 선수 기록·팀·댓글·채팅을 삭제할까요? 되돌릴 수 없어요. 이 기기의 게임 진행은 남아요.',
  deleteConfirm: '삭제',
  // account.ts — 계정 카드 제목·안내
  googleTitle: '구글 계정',
  googleVia: 'Google 계정으로 로그인했어요.',
  appleTitle: 'Apple 계정',
  appleVia: 'Apple 계정으로 로그인했어요.',
  // 로그인 버튼 · auth.ts
  loginGoogle: '구글로 로그인',
  googleFinishFail: '구글 로그인을 마치지 못했어요. 다시 시도해 주세요.',
  appleStartFail: 'Apple 로그인을 시작하지 못했어요.',
  appleFinishFail: 'Apple 로그인을 마치지 못했어요. 다시 시도해 주세요.',
  /** loginDoneText에 들어가는 로그인 수단 이름. */
  viaGoogle: '구글',
  viaApple: 'Apple',
};

export type AccountMsgs = typeof ko;
export const accountText = ns('account', ko);
