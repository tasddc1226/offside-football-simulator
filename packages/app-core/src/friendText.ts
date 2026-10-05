// T-11-098 친구 화면 문구 · 초대 링크. 웹·앱이 함께 쓴다.
import { FRIEND_INVITE_PARAM, normalizeFriendCode } from '@offside/contracts/owner-team';

/** 웹 주소(앱도 이 주소로 초대 링크를 만든다 — 받는 사람이 앱이 없어도 열린다). */
export const FRIEND_INVITE_ORIGIN = 'https://offside-lab.com';

/** 친구 코드를 읽기 쉽게 4자씩 끊는다(ABCD-EFGH). */
export const friendCodeLabel = (code: string) => `${code.slice(0, 4)}-${code.slice(4)}`;

/** 초대 링크(`/?friend=코드`). */
export const friendInviteUrl = (code: string, origin = FRIEND_INVITE_ORIGIN) =>
  `${origin}/?${FRIEND_INVITE_PARAM}=${code}`;

/** 공유 문구(카톡 등). */
export const friendInviteText = (code: string, origin?: string) =>
  `OFFSIDE에서 같이 팀 대결해요. 내 친구 코드: ${friendCodeLabel(code)}\n${friendInviteUrl(code, origin)}`;

/** 주소 쿼리에서 초대 코드를 읽는다(없거나 형식이 틀리면 null). */
export function inviteCodeFromSearch(search: string): string | null {
  const raw = new URLSearchParams(search).get(FRIEND_INVITE_PARAM);
  return raw ? normalizeFriendCode(raw) : null;
}

/** 상대 전적 한 줄(3승 1무 2패). 아직 겨룬 적이 없으면 null. */
export function h2hText(r: { w: number; d: number; l: number }): string | null {
  if (r.w + r.d + r.l === 0) return null;
  return `${r.w}승 ${r.d}무 ${r.l}패`;
}
