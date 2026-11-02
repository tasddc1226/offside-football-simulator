// T-11-622 앱 바로 열기 링크(유니버설 링크 · 앱 링크). 웹 주소를 앱 화면으로 옮긴다. RN URL 구현에 기대지 않고 글자로 읽는다.
import {
  FRIEND_INVITE_PARAM,
  FRIEND_INVITE_PATH,
  normalizeFriendCode,
} from '@offside/contracts/friend-code';

export type AppLink = { kind: 'friend'; code: string } | { kind: 'career'; id: string };

const LINK = /^(?:https:\/\/offside-lab\.com)?(\/[^?#]*)(?:\?([^#]*))?/i;
const CAREER = /^\/career\/([0-9a-f-]{36})\/?$/i;

/** 앱이 처리할 링크면 목적지를, 아니면 null을 돌려준다(다른 주소 · 형식이 틀린 코드 포함). */
export function parseAppLink(raw: string): AppLink | null {
  const match = LINK.exec(raw);
  if (!match) return null;
  const path = match[1]!;
  const career = CAREER.exec(path);
  if (career) return { kind: 'career', id: career[1]!.toLowerCase() };
  const fromPath = FRIEND_INVITE_PATH.exec(path)?.[1];
  const fromQuery =
    path === '/'
      ? new RegExp(`(?:^|&)${FRIEND_INVITE_PARAM}=([^&]*)`).exec(match[2] ?? '')?.[1]
      : undefined;
  const code = normalizeFriendCode(fromPath ?? fromQuery ?? '');
  return code ? { kind: 'friend', code } : null;
}
