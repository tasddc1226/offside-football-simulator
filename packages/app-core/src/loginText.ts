// 로그인 안내 문구(웹 ui/login.ts, 앱 platform/auth.ts가 같이 쓴다). 서버가 돌려보낸 reason 코드별 실패 안내.
import { shellLoginText as L } from './i18n/ko/shellLogin.js';

const failMsg = (reason: string): string | undefined => {
  switch (reason) {
    case 'session':
      return L.failSession;
    case 'rate_limited':
      return L.failRateLimited;
    case 'unavailable':
      return L.failUnavailable;
    case 'cancelled':
      return L.failCancelled;
    default:
      return undefined;
  }
};

/** 서버에 연결하지 못했을 때의 안내. 언어가 바뀐 뒤에도 맞게 나오도록 함수로 읽는다. */
export const loginOfflineText = (): string => L.offline;

/** 구글 로그인 실패 안내. 모르는 reason은 코드를 괄호로 붙여 문의 때 알아볼 수 있게 한다. */
export const googleFailText = (reason: string | null | undefined): string =>
  (reason && failMsg(reason)) ?? L.failGeneric({ reason: reason ?? '' });

/** T-11-202 웹 Apple 로그인 실패 안내. 공통 사유(세션·한도·취소)는 구글과 같은 문구를 쓴다. */
export const appleFailText = (reason: string | null | undefined): string =>
  reason === 'unavailable'
    ? L.failUnavailableApple
    : ((reason && failMsg(reason)) ?? L.failGenericApple({ reason: reason ?? '' }));

/** 로그인 성공 안내. via: '구글' | 'Apple'. */
export const loginDoneText = (result: 'linked' | 'switched', via: string): string => {
  const name = via === '구글' ? L.providerGoogle : via;
  return result === 'linked' ? L.linked({ via: name }) : L.switched({ via: name });
};
