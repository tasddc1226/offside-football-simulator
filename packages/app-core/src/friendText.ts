// T-11-098 친구 화면 문구 · 초대 링크. 웹·앱이 함께 쓴다.
import type {
  FriendPerson,
  FriendRequestResponse,
  FriendsResponse,
  InviteStatus,
} from '@offside/contracts';
import {
  FRIEND_INVITE_PARAM,
  INVITE_REROLLS,
  INVITE_REWARD_MAX,
} from '@offside/contracts/owner-team';
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

/** T-11-171 신청 결과 토스트 — 이 신청으로 친구 초대 이벤트에 참여했으면 그 안내를 먼저 보인다. */
export const friendRequestToast = (r: FriendRequestResponse) =>
  r.invited ? L.joinedEvent({ n: INVITE_REROLLS }) : friendRequestText(r);

/**
 * T-11-171 친구 초대 이벤트 카드 문구. mine: 나를 초대한 사람이 있을 때의 한 줄, status: 내가 초대한 친구가 있을 때의 현황,
 * maxed: 초대한 쪽 보상 상한에 닿았을 때의 안내.
 */
export function inviteEventLines(i: InviteStatus) {
  return {
    title: L.eventTitle,
    body: L.eventBody({ n: INVITE_REROLLS }),
    mine: i.invitedBy
      ? i.invitedBy.done
        ? L.invitedDone({ name: i.invitedBy.name })
        : L.invitedBy({ name: i.invitedBy.name })
      : null,
    status:
      i.pending + i.done > 0
        ? L.eventStatus({
            pending: i.pending,
            done: i.done,
            got: i.rewarded,
            max: INVITE_REWARD_MAX,
          })
        : null,
    maxed: i.rewarded >= INVITE_REWARD_MAX ? L.eventMaxed({ max: INVITE_REWARD_MAX }) : null,
  };
}

/** 상대 전적 한 줄(3승 1무 2패). 아직 겨룬 적이 없으면 null. */
export function h2hText(r: { w: number; d: number; l: number }): string | null {
  if (r.w + r.d + r.l === 0) return null;
  return teamCoreText.record(r);
}

/** T-11-113 프리시즌에 은퇴 선수를 남긴 구단주 표시. 읽을 때 지금 언어로 고른다. */
export const founderLabel = () => L.founder;

type FriendsView = Pick<FriendsResponse, 'canPlay' | 'canPlayPreseason' | 'matchesLeft'>;
type FriendTeams = Pick<FriendPerson, 'team' | 'preseasonTeam'>;

/** 이번 시즌 팀끼리 친선전을 걸 수 있는가. */
export const canFriendly = (d: FriendsView, p: FriendTeams) =>
  d.canPlay && d.matchesLeft > 0 && !!p.team && p.team.filled > 0;

/** T-11-113 프리시즌 팀끼리 친선전을 걸 수 있는가(개막 뒤). */
export const canPreseasonFriendly = (d: FriendsView, p: FriendTeams) =>
  !!d.canPlayPreseason && d.matchesLeft > 0 && !!p.preseasonTeam && p.preseasonTeam.filled > 0;

/** 친구의 프리시즌 팀 한 줄. 프리시즌 팀이 없거나 개막 전이면 null. */
export const preseasonTeamLine = (p: Pick<FriendPerson, 'preseasonTeam'>) =>
  p.preseasonTeam
    ? L.preseasonLine({ name: p.preseasonTeam.name, ovr: p.preseasonTeam.ovr })
    : null;

/** 개막 뒤 친구 화면에서 프리시즌 팀이 없는 창단 멤버에게 보이는 안내. */
export const preseasonFriendlyHint = () => L.preseasonHint;
