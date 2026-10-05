// T-11-098 친구 신청 결과 토스트(팀 화면의 친구 코드 신청과 팀 프로필의 '친구 신청'이 같은 문구를 쓴다).
import type { FriendRequestResponse } from '@offside/app-core/api/friends';

export const friendRequestMessage = (r: FriendRequestResponse) =>
  r.state === 'sent' ? '친구 신청을 보냈어요' : `${r.friend.name} 님과 친구가 됐어요`;
