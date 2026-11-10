import type { NotificationTopic } from '@offside/contracts';

// 알림 종류(kind)별 옛 설정 열. 주제 값을 고르지 않은 계정은 이 설정을 따른다.
const KIND_COLUMN: Record<string, string> = {
  team: 'team',
  market: 'market',
  social: 'social',
  return: 'nudge',
};
// 주제별 설정 열. 이적시장은 주제가 하나뿐이라 옛 열(market)을 그대로 쓴다.
const TOPIC_COLUMN: Record<NotificationTopic, string | null> = {
  match: 'topic_match',
  cup: 'topic_cup',
  league: 'topic_league',
  market: null,
  friend: 'topic_friend',
  reward: 'topic_reward',
  attendance: 'topic_attendance',
  comeback: 'topic_comeback',
};
const columnsOf = (kind: string, topic: NotificationTopic | null, alias: string) =>
  [topic && TOPIC_COLUMN[topic], KIND_COLUMN[kind]]
    .filter((column): column is string => !!column)
    .map((column) => `${alias}.${column}`);

/**
 * 이 종류 · 주제의 푸시를 받는가(SQL 조건). `alias`는 LEFT JOIN한 push_preferences다.
 * 주제 값 → 종류 설정 → 켬 순서로 본다. kind · topic은 서버가 정한 값만 넣는다(SQL에 그대로 들어간다).
 */
export function prefAllows(kind: string, topic: NotificationTopic | null, alias = 'pref') {
  const columns = columnsOf(kind, topic, alias);
  return columns.length ? `COALESCE(${columns.join(', ')}, 1) = 1` : '1 = 1';
}

/** push_preferences를 join하지 않은 쿼리용: 프로필 id 식으로 설정 행을 찾아 같은 순서로 본다. */
export function prefAllowsProfile(
  kind: string,
  topic: NotificationTopic | null,
  profileId: string,
) {
  const columns = columnsOf(kind, topic, 'tp');
  if (!columns.length) return '1 = 1';
  const value = columns.length > 1 ? `COALESCE(${columns.join(', ')})` : columns[0];
  return `COALESCE((SELECT ${value} FROM push_preferences tp WHERE tp.profile_id = ${profileId}), 1) = 1`;
}

const topicCase = (n: string, alias: string) =>
  `CASE ${n}.topic ${Object.entries(TOPIC_COLUMN)
    .filter(([, column]) => column)
    .map(([topic, column]) => `WHEN '${topic}' THEN ${alias}.${column}`)
    .join(' ')} END`;
const kindCase = (n: string, alias: string) =>
  `CASE ${n}.kind ${Object.entries(KIND_COLUMN)
    .map(([kind, column]) => `WHEN '${kind}' THEN ${alias}.${column}`)
    .join(' ')} END`;
/** 알림 행마다 종류 · 주제가 다른 쿼리용(발송 직전 재확인). `n`은 notifications 별칭이다. */
export const prefAllowsRow = (n = 'n', alias = 'pref') =>
  `COALESCE(${topicCase(n, alias)}, ${kindCase(n, alias)}, 1) = 1`;

/** 알림함 묶음 보기 조건. 주제를 적기 전 행은 종류로 나눈다. */
export const GROUP_WHERE = {
  game: "(topic IN ('match','cup','league') OR (topic IS NULL AND kind = 'team'))",
  market: "kind = 'market'",
  social: "(topic IN ('friend','reward') OR (topic IS NULL AND kind = 'social'))",
  news: "kind = 'news'",
  nudge: "kind = 'return'",
} as const;
