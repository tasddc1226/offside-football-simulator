// T-11-098 친구 화면 문구 · 초대 링크. 웹·앱이 함께 쓴다.
import { FRIEND_INVITE_PARAM } from '@offside/contracts/owner-team';
import { friendText as L } from './i18n/ko/friend.js';
import { teamCoreText } from './i18n/ko/teamCore.js';

/** 웹 주소(앱도 이 주소로 초대 링크를 만든다 — 받는 사람이 앱이 없어도 열린다). */
const FRIEND_INVITE_ORIGIN = 'https://offside-lab.com';

/** 친구 코드를 읽기 쉽게 4자씩 끊는다(ABCD-EFGH). */
export const friendCodeLabel = (code: string) => `${code.slice(0, 4)}-${code.slice(4)}`;

/** 초대 링크(`/?friend=코드`). */
export const friendInviteUrl = (code: string, origin = FRIEND_INVITE_ORIGIN) =>
  `${origin}/?${FRIEND_INVITE_PARAM}=${code}`;

/** 공유 문구(카톡 등). */
export const friendInviteText = (code: string, origin?: string) =>
  L.invite({ code: friendCodeLabel(code), url: friendInviteUrl(code, origin) });

/** 친구가 됐을 때 알림. */
export const friendAcceptedText = (name: string) => L.accepted({ name });

/** 친구 신청 결과 알림(코드로 신청 · 팀 프로필의 친구 신청). 상대가 먼저 신청했으면 곧바로 친구가 된다. */
export const friendRequestText = (r: { state: 'sent' | 'accepted'; friend: { name: string } }) =>
  r.state === 'sent' ? L.requestSent : friendAcceptedText(r.friend.name);

/** 상대 전적 한 줄(3승 1무 2패). 아직 겨룬 적이 없으면 null. */
export function h2hText(r: { w: number; d: number; l: number }): string | null {
  if (r.w + r.d + r.l === 0) return null;
  return teamCoreText.record(r);
}
