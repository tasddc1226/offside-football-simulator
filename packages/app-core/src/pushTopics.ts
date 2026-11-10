// 알림 주제 묶음. 권한 요청 전 선택 창 · 설정 화면 · 알림함 묶음 보기가 같은 구분을 쓴다.
import {
  NOTIFICATION_GROUPS,
  type NotificationGroup,
  type PushTopic,
  type PushTopicPreferences,
} from '@offside/contracts';
import type { PushAskPlace } from './analytics-native.js';

export type PushGroup = NotificationGroup;
export const PUSH_GROUPS: readonly PushGroup[] = NOTIFICATION_GROUPS;
export const GROUP_TOPICS: Record<PushGroup, readonly PushTopic[]> = {
  game: ['match', 'cup', 'league'],
  market: ['market'],
  social: ['friend', 'reward'],
  news: ['notice', 'release'],
  nudge: ['attendance', 'comeback'],
};
export type PushPicks = Record<PushGroup, boolean>;
/** 선택 창의 처음 값. 출석 · 복귀 알림은 받겠다고 고른 사람에게만 보낸다. */
export const DEFAULT_PUSH_PICKS: PushPicks = {
  game: true,
  market: true,
  social: true,
  news: true,
  nudge: false,
};
// 권유가 뜬 자리와 가장 가까운 묶음. 선택 창에서 맨 위에 올린다.
const PLACE_GROUP: Partial<Record<PushAskPlace, PushGroup>> = {
  sell: 'market',
  club: 'game',
  league: 'game',
  cup: 'game',
  retire: 'game',
  friends: 'social',
};
export function pickerGroups(place: PushAskPlace): PushGroup[] {
  const first = PLACE_GROUP[place];
  return first ? [first, ...PUSH_GROUPS.filter((g) => g !== first)] : [...PUSH_GROUPS];
}
/** 고른 묶음을 주제별 값으로 편다(설정 저장 요청 하나의 본문). */
export function picksToTopics(picks: PushPicks): PushTopicPreferences {
  const topics = {} as PushTopicPreferences;
  for (const group of PUSH_GROUPS)
    for (const topic of GROUP_TOPICS[group]) topics[topic] = picks[group];
  return topics;
}
/** 분석 이벤트에 싣는 고른 묶음 목록(예: "game,market"). */
export const pickedGroups = (picks: PushPicks) => PUSH_GROUPS.filter((g) => picks[g]).join(',');
/** 옛 서버 응답(설정 6개)을 주제 모양으로 읽는다. 서버가 주제 모양을 주기 전 배포 순서에서만 쓴다. */
export function topicsFromLegacy(v: {
  notice?: boolean;
  release?: boolean;
  team?: boolean;
  market?: boolean;
  social?: boolean;
  nudge?: boolean;
}): PushTopicPreferences {
  const team = v.team ?? true;
  const social = v.social ?? true;
  const nudge = v.nudge ?? true;
  return {
    match: team,
    cup: team,
    league: team,
    market: v.market ?? true,
    friend: social,
    reward: team || social,
    attendance: nudge,
    comeback: nudge,
    notice: v.notice ?? true,
    release: v.release ?? true,
  };
}
