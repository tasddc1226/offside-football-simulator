// T-11-098 친구 초대 링크(`/?friend=코드`)와 팀 화면 '경기' 탭의 랭크 경기 · 친구 전환. 첫 화면 번들에 들어간다.
import { FRIEND_INVITE_PARAM, normalizeFriendCode } from '@offside/contracts/friend-code';
import { go } from './nav.js';
import { appState } from './state.svelte.js';

const KEY = 'ft_friend_invite';
/** 초대 링크로 들어온 코드는 하루 동안 기억한다(그 사이 로그인하고 돌아와도 신청할 수 있게). */
const KEEP_MS = 24 * 60 * 60 * 1000;

/** 저장소를 못 쓰는 브라우저(사생활 보호 모드 등)에서도 이번 방문 동안은 코드를 들고 있는다. */
let memo: string | null = null;

/** '경기' 탭에서 보고 있는 쪽. */
export const friendsUi = $state<{ mode: 'ranked' | 'friends' }>({ mode: 'ranked' });

/** 초대 링크로 받은 코드(없거나 하루가 지났으면 null). */
export function pendingInvite(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return memo;
    const { code, at } = JSON.parse(raw) as { code?: string; at?: number };
    if (!code || !at || Date.now() - at > KEEP_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return normalizeFriendCode(code);
  } catch {
    return memo;
  }
}

export function clearInvite() {
  memo = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    // 저장소를 못 쓰면 기억한 코드도 없다.
  }
}

/** 팀 화면 '경기' 탭의 친구 쪽을 연다. */
export function openFriends() {
  friendsUi.mode = 'friends';
  appState.teamView = 'opponents';
  go('team');
}

/** 앱 시작 때 한 번: 초대 링크로 들어왔으면 코드를 기억하고 주소를 정리한 뒤 친구 화면을 연다. */
export function routeFriendInvite() {
  const raw = new URLSearchParams(window.location.search).get(FRIEND_INVITE_PARAM);
  if (raw === null) return;
  const code = normalizeFriendCode(raw);
  const url = new URL(window.location.href);
  url.searchParams.delete(FRIEND_INVITE_PARAM);
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  if (!code) return;
  memo = code;
  try {
    localStorage.setItem(KEY, JSON.stringify({ code, at: Date.now() }));
  } catch {
    // 기억하지 못해도 이번 방문에는 친구 화면이 열린다(코드는 직접 넣는다).
  }
  openFriends();
}
