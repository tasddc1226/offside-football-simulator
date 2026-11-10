import {
  PushPreferencesSchema,
  PushTopicPreferencesSchema,
  type PutPushPreferences,
} from '@offside/contracts';
import { eq } from 'drizzle-orm';
import type { Db } from '../client.js';
import { pushPreferences } from '../schema.js';

const columns = {
  notice: pushPreferences.notice,
  release: pushPreferences.release,
  team: pushPreferences.team,
  market: pushPreferences.market,
  social: pushPreferences.social,
  nudge: pushPreferences.nudge,
  topicMatch: pushPreferences.topicMatch,
  topicCup: pushPreferences.topicCup,
  topicLeague: pushPreferences.topicLeague,
  topicFriend: pushPreferences.topicFriend,
  topicReward: pushPreferences.topicReward,
  topicAttendance: pushPreferences.topicAttendance,
  topicComeback: pushPreferences.topicComeback,
};
type Row = {
  notice: boolean;
  release: boolean;
  team: boolean;
  market: boolean;
  social: boolean;
  nudge: boolean;
  topicMatch: boolean | null;
  topicCup: boolean | null;
  topicLeague: boolean | null;
  topicFriend: boolean | null;
  topicReward: boolean | null;
  topicAttendance: boolean | null;
  topicComeback: boolean | null;
};
const DEFAULT_ROW: Row = {
  notice: true,
  release: true,
  team: true,
  market: true,
  social: true,
  nudge: true,
  topicMatch: null,
  topicCup: null,
  topicLeague: null,
  topicFriend: null,
  topicReward: null,
  topicAttendance: null,
  topicComeback: null,
};

/**
 * 한 행을 옛 모양(설정 6개)과 주제 모양(실제 적용 값 10개)으로 함께 돌려준다.
 * 주제 값을 고르지 않았으면 그 알림 종류의 옛 설정을 따른다(발송 판정 `push/prefs.ts`와 같은 순서).
 * 보상 알림은 종류가 팀 · 친구 둘 다라, 고르지 않았으면 둘 중 하나라도 켜져 있을 때 켬으로 보인다.
 */
const view = (r: Row) => ({
  legacy: PushPreferencesSchema.parse({
    notice: r.notice,
    release: r.release,
    team: r.team,
    market: r.market,
    social: r.social,
    nudge: r.nudge,
  }),
  topics: PushTopicPreferencesSchema.parse({
    match: r.topicMatch ?? r.team,
    cup: r.topicCup ?? r.team,
    league: r.topicLeague ?? r.team,
    market: r.market,
    friend: r.topicFriend ?? r.social,
    reward: r.topicReward ?? (r.team || r.social),
    attendance: r.topicAttendance ?? r.nudge,
    comeback: r.topicComeback ?? r.nudge,
    notice: r.notice,
    release: r.release,
  }),
});

export async function getPushPreferences(db: Db, profileId: string) {
  const [row] = await db
    .select(columns)
    .from(pushPreferences)
    .where(eq(pushPreferences.profileId, profileId));
  return view(row ?? DEFAULT_ROW);
}

/** 요청 키를 열 변경으로 옮긴다. 옛 키(team · social · nudge)를 바꾸면 그 아래 주제 값을 비워 옛 설정을 따르게 한다. */
export function preferenceChange(input: PutPushPreferences): Partial<Row> {
  const set: Partial<Row> = {};
  if (input.notice !== undefined) set.notice = input.notice;
  if (input.release !== undefined) set.release = input.release;
  if (input.market !== undefined) set.market = input.market;
  if (input.team !== undefined) {
    set.team = input.team;
    set.topicMatch = set.topicCup = set.topicLeague = set.topicReward = null;
  }
  if (input.social !== undefined) {
    set.social = input.social;
    set.topicFriend = set.topicReward = null;
  }
  if (input.nudge !== undefined) {
    set.nudge = input.nudge;
    set.topicAttendance = set.topicComeback = null;
  }
  if (input.match !== undefined) set.topicMatch = input.match;
  if (input.cup !== undefined) set.topicCup = input.cup;
  if (input.league !== undefined) set.topicLeague = input.league;
  if (input.friend !== undefined) set.topicFriend = input.friend;
  if (input.reward !== undefined) set.topicReward = input.reward;
  if (input.attendance !== undefined) set.topicAttendance = input.attendance;
  if (input.comeback !== undefined) set.topicComeback = input.comeback;
  return set;
}

export async function putPushPreferences(db: Db, profileId: string, input: PutPushPreferences) {
  const set = preferenceChange(input);
  const [row] = await db
    .insert(pushPreferences)
    .values({ profileId, ...set })
    .onConflictDoUpdate({ target: pushPreferences.profileId, set })
    .returning(columns);
  return view(row ?? DEFAULT_ROW);
}
