// 로그인 안내 문구(웹 ui/login.ts · 앱 platform/auth.ts가 app-core loginText.ts로 같이 쓴다).
import { ns } from '../core';

const ko = {
  failSession: '로그인 준비가 끝나지 않았어요. 다시 눌러 주세요.',
  failRateLimited: '로그인 시도가 너무 많아요. 잠시 뒤 다시 시도해 주세요.',
  failUnavailable: '지금은 구글 로그인을 사용할 수 없어요. 잠시 뒤 다시 시도해 주세요.',
  failCancelled: '로그인을 취소했어요.',
  offline: '서버에 연결하지 못했어요. 잠시 후 다시 로그인해 주세요.',
  // reason은 모르는 실패 코드(없으면 빈 문자열). 있으면 괄호로 붙여 문의 때 알아볼 수 있게 한다.
  failGeneric: (p: { reason: string }) =>
    `구글 로그인에 실패했어요${p.reason ? ` (${p.reason})` : ''}.`,
  providerGoogle: '구글',
  // T-11-202 웹 Apple 로그인 실패 안내.
  failUnavailableApple: '지금은 Apple 로그인을 사용할 수 없어요. 잠시 뒤 다시 시도해 주세요.',
  failGenericApple: (p: { reason: string }) =>
    `Apple 로그인에 실패했어요${p.reason ? ` (${p.reason})` : ''}.`,
  linked: (p: { via: string }) => `${p.via} 계정을 연결했어요.`,
  switched: (p: { via: string }) => `다른 ${p.via} 계정으로 바꿨어요.`,
};

export type ShellLoginMsgs = typeof ko;
export const shellLoginText = ns('shellLogin', ko);
