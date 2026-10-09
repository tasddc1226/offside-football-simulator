// T-11-177 운영 도구 친구 초대 현황(웹 admin/AdminInvites.svelte · 앱 settings/admin/AdminInvites.tsx 공용). 운영 도구는 한국어.
import type { AdminInvite, AdminInviteReport, AdminInviter } from '@offside/contracts';
import { INVITE_REWARD_MAX } from '@offside/contracts/owner-team';
import { kstDateTime as kst } from '../boardText.js';

export const INVITE_NOTE = `친구 코드로 신청한 새 구단주가 초대예요. 첫 커리어를 마치면 초대받은 사람은 늘, 초대한 사람은 ${INVITE_REWARD_MAX}명까지 리롤권을 받아요.`;

export const nick = (name: string | null) => name ?? '닉네임 없음';

export const inviteSummary = (r: AdminInviteReport): [string, string][] => [
  ['초대', `${r.invites.toLocaleString()}건`],
  ['초대한 구단주', `${r.inviters.toLocaleString()}명`],
  ['첫 커리어를 마침', `${r.done.toLocaleString()}건`],
  ['초대한 쪽 보상', `${r.inviterRewarded.toLocaleString()}건`],
  ['지급된 리롤권', `${r.rerolls.toLocaleString()}장`],
];

export const inviterLine = (t: AdminInviter) =>
  `${t.invited}명 · 마침 ${t.done} · 보상 ${t.rewarded}`;
export const invitePair = (v: AdminInvite) =>
  `${nick(v.inviterNickname)} → ${nick(v.inviteeNickname)}`;
export const inviteState = (v: AdminInvite) => (v.doneAt ? `마침 ${kst(v.doneAt)}` : '진행 중');
