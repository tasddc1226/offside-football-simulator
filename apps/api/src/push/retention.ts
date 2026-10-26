import type { Bindings } from '../env.js';
import { kstDay } from '@offside/contracts/kst';
import { SERVICE_SEASONS } from '@offside/contracts/service-seasons';
import type { RetentionStory } from '../i18n/ko/retentionPush.js';
import { retentionContent, type RetentionParams } from './retentionText.js';

// T-11-501 리텐션 푸시. 옛 커리어 독려(careerReminder.ts)와 재방문 안내(reengagement.ts)를 대신한다.
// - 쉬는 사람(lapsed): 마지막 방문 뒤 3 · 7 · 14 · 30일에 한 번씩. 그 사이 생긴 일(판매 · 랭크 경기)이 있으면 그 이야기를,
//   없으면 이어 하던 선수 · 새 시즌 · 업데이트 소식을 보낸다. 30일째 인사로 끝낸다.
// - 첫 주(onboarding): 가입 7일 안, 하루 넘게 오지 않은 사람에게 다음 할 일 하나(최대 3번, 단계마다 한 번).
// 방문은 앱 기기 등록 갱신(하루 한 번)과 커리어 활동 중 늦은 쪽이다. KST 12시대에만 쌓고, 사람마다 하루 독려 하나다
// (같은 날 다른 kind 'return' 알림이 있으면 건너뛴다). 비교군(holdout)은 알림 없이 원장 줄만 남긴다. 시즌 개막일은 쉰다.

const DAY = 86400_000;
const HOUR = 3600_000;
/** 한 틱에 고르는 사람 수(12시대 틱 12번이면 1,200명). */
const LIMIT = 100;
/** 마지막 방문이 이보다 오래면 사다리에 넣지 않는다(30일 인사를 늦게 받는 사람을 막는다). */
const LAPSED_MAX_DAYS = 45;
const ONBOARDING_DAYS = 7;
const ONBOARDING_MAX = 3;
/** 비교군 비율(프로필 ID 끝 두 자리 16진수 < 26 → 256 중 26, 약 10%). */
const HOLDOUT_CUT = 26;
const iso = (time: number) => new Date(time).toISOString();

export const LAPSED_STAGES = [3, 7, 14, 30] as const;
/** onboarding 단계: 1 선수 만들기 · 2 은퇴 · 3 로그인 · 4 구단 만들기 · 5 첫 랭크 경기 (6은 다 했다). */
export const ONBOARDING_STORIES: Record<number, RetentionStory> = {
  1: 'create',
  2: 'retire',
  3: 'login',
  4: 'club',
  5: 'rank',
};

export const retentionPushEnabled = (env: Bindings) =>
  env.ENVIRONMENT === 'production' &&
  env.PERSONAL_PUSH_ENABLED === '1' &&
  env.RETENTION_PUSH_ENABLED === '1';
/** KST 12시대(점심). 출석 독려(19시대)와 겹치지 않는다. */
export const retentionWindow = (time: number) => new Date(time + 9 * HOUR).getUTCHours() === 12;

const holdoutUntil = (env: Bindings) => Date.parse(env.RETENTION_HOLDOUT_UNTIL ?? '');
/** 프로필 ID 끝 두 글자(prf_<uuid>의 16진수)로 고정 배정한다. 같은 사람은 늘 같은 쪽이다. */
export const inHoldout = (profileId: string) => {
  const n = Number.parseInt(profileId.slice(-2), 16);
  return Number.isFinite(n) && n < HOLDOUT_CUT;
};
/** 오늘(KST)이 어느 시즌의 개막일이면 쉰다(개막 공지 · 순위 알림과 겹치지 않게). */
export const seasonOpeningDay = (time: number) =>
  SERVICE_SEASONS.some((s) => kstDay(s.startsAt) === kstDay(iso(time)));

/** 방문(기기 등록 갱신 · 커리어 활동 중 늦은 쪽). p는 profiles. */
const VISIT = `max(COALESCE((SELECT MAX(d.updated_at) FROM push_devices d WHERE d.profile_id = p.id), ''),
  COALESCE((SELECT a.last_active_at FROM career_activity a WHERE a.profile_id = p.id), ''))`;
/** 지금 다음 할 일 단계(ONBOARDING_STORIES, 6은 다 했다). */
const STEP = `CASE
  WHEN NOT EXISTS (SELECT 1 FROM career_activity a WHERE a.profile_id = p.id)
    AND NOT EXISTS (SELECT 1 FROM careers c WHERE c.profile_id = p.id) THEN 1
  WHEN NOT EXISTS (SELECT 1 FROM careers c WHERE c.profile_id = p.id AND c.status = 'retired')
    AND NOT EXISTS (SELECT 1 FROM career_activity a WHERE a.profile_id = p.id AND a.state = 'retired') THEN 2
  WHEN p.google_sub IS NULL AND p.apple_sub IS NULL THEN 3
  WHEN NOT EXISTS (SELECT 1 FROM owner_teams t WHERE t.profile_id = p.id) THEN 4
  WHEN NOT EXISTS (SELECT 1 FROM team_matches m WHERE m.profile_id = p.id) THEN 5
  ELSE 6 END`;
/**
 * 후보: 최근 LAPSED_MAX_DAYS일 안에 갱신된 앱 기기(로그아웃 · 만료되지 않은 앱 세션)가 있는 사람. 기기 표의 갱신 시각 인덱스로
 * 고르므로 전체 프로필을 훑지 않는다. 독려 알림을 끈 사람은 비교군에도 넣지 않는다.
 */
const REACHABLE = `(SELECT DISTINCT d.profile_id AS id FROM push_devices d JOIN sessions s ON s.id = d.session_id
    WHERE d.updated_at >= ?9 AND d.engagement_enabled IN (0, 1) AND s.profile_id = d.profile_id
      AND s.channel = 'app' AND s.revoked_at IS NULL AND s.expires_at > ?1) dv
  JOIN profiles p ON p.id = dv.id`;
const FRESH = `p.deleted_at IS NULL
  AND COALESCE((SELECT nudge FROM push_preferences pref WHERE pref.profile_id = p.id), 1) = 1
  AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.profile_id = p.id AND n.kind = 'return' AND n.created_at >= ?2)
  AND NOT EXISTS (SELECT 1 FROM retention_pushes r WHERE r.profile_id = p.id AND r.created_at >= ?2)`;

type LapsedRow = {
  id: string;
  visit: string;
  career: number;
  sold: number;
  matches: string | null;
};
type OnboardingRow = { id: string; step: number };
type Choice = {
  profileId: string;
  campaign: 'lapsed' | 'onboarding';
  stage: number;
  story: RetentionStory;
  params: RetentionParams;
  lapseKey: string;
};
const TARGETS: Record<RetentionStory, object> = {
  career: { type: 'screen', screen: 'home' },
  matches: { type: 'screen', screen: 'team' },
  sold: { type: 'screen', screen: 'market' },
  season: { type: 'screen', screen: 'owner' },
  news: { type: 'screen', screen: 'home' },
  farewell: { type: 'screen', screen: 'home' },
  create: { type: 'screen', screen: 'home' },
  retire: { type: 'screen', screen: 'home' },
  login: { type: 'screen', screen: 'settings' },
  club: { type: 'screen', screen: 'owner' },
  rank: { type: 'screen', screen: 'team' },
};

export const lapsedStage = (days: number) =>
  [...LAPSED_STAGES].reverse().find((s) => days >= s) ?? null;

/** 쉬는 사람 단계에 맞는 이야기. 3 · 7일은 그 사이 생긴 일을 먼저, 14일은 새 시즌을 먼저 고른다. */
export function lapsedStory(
  stage: number,
  row: Pick<LapsedRow, 'career' | 'sold' | 'matches'>,
  season: number | null,
): { story: RetentionStory; params: RetentionParams } {
  if (stage >= 30) return { story: 'farewell', params: {} };
  const [n = 0, w = 0, d = 0] = (row.matches ?? '').split(',').map(Number);
  if (stage >= 14) {
    if (season !== null) return { story: 'season', params: { season } };
  } else if (row.sold > 0) return { story: 'sold', params: { n: row.sold } };
  else if (n > 0) return { story: 'matches', params: { n, w, d, l: n - w - d } };
  if (row.career) return { story: 'career', params: {} };
  return { story: 'news', params: {} };
}

/** 마지막 방문 뒤 열린 시즌 중 가장 최근(아직 열리지 않은 시즌은 뺀다). */
const seasonSince = (visit: string, time: number) =>
  [...SERVICE_SEASONS].reverse().find((s) => s.startsAt > visit && Date.parse(s.startsAt) <= time)
    ?.id ?? null;

export async function queueRetentionPushes(env: Bindings, time = Date.now()) {
  if (!retentionPushEnabled(env)) return { enabled: false };
  if (time % HOUR < 5 * 60_000) await measureRetention(env, time);
  if (!retentionWindow(time) || seasonOpeningDay(time)) return { enabled: true, created: 0 };
  const now = iso(time);
  const todayStart = iso(Date.parse(`${kstDay(now)}T00:00:00+09:00`));
  const [lapsed, onboarding] = await env.DB.batch([
    env.DB.prepare(
      `SELECT * FROM (SELECT p.id, ${VISIT} AS visit,
          COALESCE((SELECT a.state = 'active' FROM career_activity a WHERE a.profile_id = p.id), 0) AS career,
          (SELECT COUNT(*) FROM market_listings l WHERE l.seller_id = p.id AND l.status = 'sold' AND l.closed_at > ${VISIT}) AS sold,
          (SELECT COUNT(*) || ',' || SUM(m.away_goals > m.home_goals) || ',' || SUM(m.away_goals = m.home_goals)
            FROM team_matches m JOIN owner_teams t ON t.id = m.away_team_id
            WHERE t.profile_id = p.id AND m.created_at > ${VISIT}) AS matches
        FROM ${REACHABLE} WHERE p.created_at <= ?3 AND ${FRESH}) c
      WHERE c.visit <> '' AND c.visit <= ?4 AND c.visit >= ?5
        AND NOT EXISTS (SELECT 1 FROM retention_pushes r WHERE r.profile_id = c.id AND r.campaign = 'lapsed'
          AND r.lapse_key = c.visit AND r.stage >= CASE
            WHEN c.visit <= ?6 THEN 30 WHEN c.visit <= ?7 THEN 14 WHEN c.visit <= ?8 THEN 7 ELSE 3 END)
      ORDER BY c.visit DESC LIMIT ${LIMIT}`,
    ).bind(
      now,
      todayStart,
      iso(time - ONBOARDING_DAYS * DAY),
      iso(time - 3 * DAY),
      iso(time - LAPSED_MAX_DAYS * DAY),
      iso(time - 30 * DAY),
      iso(time - 14 * DAY),
      iso(time - 7 * DAY),
      iso(time - LAPSED_MAX_DAYS * DAY),
    ),
    env.DB.prepare(
      `SELECT * FROM (SELECT p.id, ${STEP} AS step, ${VISIT} AS visit FROM ${REACHABLE}
        WHERE p.created_at > ?3 AND ${FRESH}
          AND (SELECT COUNT(*) FROM retention_pushes r WHERE r.profile_id = p.id AND r.campaign = 'onboarding') < ${ONBOARDING_MAX}) c
      WHERE c.step < 6 AND c.visit <= ?4
        AND NOT EXISTS (SELECT 1 FROM retention_pushes r WHERE r.profile_id = c.id AND r.campaign = 'onboarding' AND r.stage = c.step)
      LIMIT ${LIMIT}`,
    ).bind(
      now,
      todayStart,
      iso(time - ONBOARDING_DAYS * DAY),
      iso(time - DAY),
      null,
      null,
      null,
      null,
      iso(time - ONBOARDING_DAYS * DAY),
    ),
  ]);
  const picks: Choice[] = [
    ...(lapsed!.results as LapsedRow[]).flatMap((row) => {
      const stage = lapsedStage((time - Date.parse(row.visit)) / DAY);
      if (stage === null) return [];
      const { story, params } = lapsedStory(stage, row, seasonSince(row.visit, time));
      return [
        {
          profileId: row.id,
          campaign: 'lapsed' as const,
          stage,
          story,
          params,
          lapseKey: row.visit,
        },
      ];
    }),
    ...(onboarding!.results as OnboardingRow[]).map((row) => ({
      profileId: row.id,
      campaign: 'onboarding' as const,
      stage: row.step,
      story: ONBOARDING_STORIES[row.step]!,
      params: {},
      lapseKey: 'signup',
    })),
  ];
  if (!picks.length) return { enabled: true, created: 0, holdout: 0 };
  const holding = time < holdoutUntil(env);
  const expires = iso(Date.parse(`${kstDay(now)}T19:00:00+09:00`));
  const statements: D1PreparedStatement[] = [];
  let created = 0;
  let holdout = 0;
  for (const pick of picks) {
    const variant = holding && inHoldout(pick.profileId) ? 'holdout' : 'send';
    const rowId = `rtp_${crypto.randomUUID().replaceAll('-', '')}`;
    const notificationId =
      variant === 'send' ? `ntf_${crypto.randomUUID().replaceAll('-', '')}` : null;
    // 같은 단계 줄이 이미 있으면(다른 틱이 먼저 쌓았으면) 알림도 만들지 않는다(changes() > 0).
    statements.push(
      env.DB.prepare(
        `INSERT OR IGNORE INTO retention_pushes
        (id, profile_id, campaign, stage, story, variant, lapse_key, notification_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
      ).bind(
        rowId,
        pick.profileId,
        pick.campaign,
        pick.stage,
        pick.story,
        variant,
        pick.lapseKey,
        now,
      ),
    );
    if (!notificationId) {
      holdout++;
      continue;
    }
    created++;
    const content = retentionContent(pick.story, pick.params);
    const sourceKey = `retention:${pick.campaign}:${pick.stage}:${pick.profileId}:${pick.lapseKey}`;
    statements.push(
      env.DB.prepare(
        `INSERT OR IGNORE INTO notifications (id, profile_id, source_key, kind, title, body, target_json, created_at, expires_at)
        SELECT ?, ?, ?, 'return', ?, ?, ?, ?, ? WHERE changes() > 0`,
      ).bind(
        notificationId,
        pick.profileId,
        sourceKey,
        content.title,
        content.body,
        JSON.stringify(TARGETS[pick.story]),
        now,
        iso(time + 30 * DAY),
      ),
      env.DB.prepare(
        `UPDATE retention_pushes SET notification_id = ? WHERE id = ? AND EXISTS (SELECT 1 FROM notifications WHERE id = ?)`,
      ).bind(notificationId, rowId, notificationId),
      // 가장 최근 앱 기기 하나로만 보낸다. 19시(KST)가 지나면 보내지 않는다.
      env.DB.prepare(
        `INSERT OR IGNORE INTO push_deliveries
        (id, notification_id, installation_hash, session_id, profile_id, token, due_at, expires_at, updated_at)
        SELECT n.id || ':' || d.installation_hash, n.id, d.installation_hash, d.session_id, d.profile_id, d.token, ?, ?, ?
        FROM notifications n JOIN push_devices d ON d.installation_hash = (SELECT device.installation_hash
          FROM push_devices device JOIN sessions s ON s.id = device.session_id
          WHERE device.profile_id = n.profile_id AND s.profile_id = n.profile_id AND s.channel = 'app'
            AND s.revoked_at IS NULL AND s.expires_at > ?
          ORDER BY device.updated_at DESC, device.installation_hash LIMIT 1)
        WHERE n.id = ?`,
      ).bind(now, expires, now, now, notificationId),
    );
  }
  await env.DB.batch(statements);
  console.log(JSON.stringify({ job: 'retention-push-enqueue', created, holdout }));
  return { enabled: true, created, holdout };
}

/**
 * 원장 줄을 만든 뒤 7일 안의 첫 방문(returned_at)과, 첫 주 안내라면 그 단계를 넘긴 시각(progressed_at)을 적는다. 매시
 * 첫 틱에 한 번, 최근 8일 줄만 본다. 보낸 쪽과 비교군을 같은 기준으로 잰다.
 */
export async function measureRetention(env: Bindings, time = Date.now()) {
  const now = iso(time);
  const since = iso(time - 8 * DAY);
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE retention_pushes SET returned_at = ?1
      WHERE returned_at IS NULL AND created_at >= ?2 AND julianday(?1) - julianday(created_at) <= 7
        AND (EXISTS (SELECT 1 FROM push_devices d WHERE d.profile_id = retention_pushes.profile_id
            AND d.updated_at > retention_pushes.created_at)
          OR EXISTS (SELECT 1 FROM career_activity a WHERE a.profile_id = retention_pushes.profile_id
            AND a.last_active_at > retention_pushes.created_at))`,
    ).bind(now, since),
    env.DB.prepare(
      `UPDATE retention_pushes SET progressed_at = ?1
      WHERE campaign = 'onboarding' AND progressed_at IS NULL AND created_at >= ?2
        AND julianday(?1) - julianday(created_at) <= 7
        AND (SELECT ${STEP} FROM profiles p WHERE p.id = retention_pushes.profile_id) > stage`,
    ).bind(now, since),
  ]);
}
