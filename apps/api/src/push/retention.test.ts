import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { callJson, issueCookie, issueGoogleCookie } from '../test/http.js';
import { addAppPushDevice } from '../test/push.js';
import {
  inHoldout,
  lapsedStage,
  lapsedStory,
  measureRetention,
  queueRetentionPushes,
  seasonOpeningDay,
} from './retention.js';
import { queueAttendanceReminders } from './attendanceReminder.js';
import { runPersonalPush } from './personal.js';
import { pushText } from './text.js';
import { getPushPerformance } from '../db/repos/pushPerformance.js';
import { retentionPushText as ko } from '../i18n/ko/retentionPush.js';
import { retentionPushText as en } from '../i18n/en/retentionPush.js';
import { retentionPushText as ja } from '../i18n/ja/retentionPush.js';

// T-11-501 리텐션 푸시(쉬는 사람 사다리 · 첫 주 다음 할 일).
const DAY = 86400_000;
const NOW = Date.parse('2026-10-28T03:05:00.000Z'); // KST 12:05
const iso = (n: number) => new Date(n).toISOString();
let ctx: TestD1;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  ctx = await createTestD1();
  Object.assign(ctx.env, {
    ENVIRONMENT: 'production',
    PERSONAL_PUSH_ENABLED: '1',
    RETENTION_PUSH_ENABLED: '1',
    ATTENDANCE_REMINDER_ENABLED: '1',
  });
});
afterEach(async () => {
  vi.useRealTimers();
  await ctx.dispose();
});

const rows = async (table: string) =>
  (
    await ctx.env.DB.prepare(
      `SELECT * FROM ${table} ORDER BY ${table === 'push_deliveries' ? 'due_at' : 'created_at, rowid'}`,
    ).all<Record<string, unknown>>()
  ).results;
const run = (sql: string, ...binds: unknown[]) =>
  ctx.env.DB.prepare(sql)
    .bind(...binds)
    .run();
/** 가입 createdDaysAgo일 전, 마지막 방문 seenDaysAgo일 전인 앱 사용자. */
async function person(createdDaysAgo: number, seenDaysAgo: number, google = true) {
  const who = google ? await issueGoogleCookie(ctx) : await issueCookie(ctx);
  await addAppPushDevice(ctx, who.profileId);
  await run(
    'UPDATE profiles SET created_at=? WHERE id=?',
    iso(NOW - createdDaysAgo * DAY),
    who.profileId,
  );
  await run(
    'UPDATE push_devices SET updated_at=? WHERE profile_id=?',
    iso(NOW - seenDaysAgo * DAY),
    who.profileId,
  );
  return who;
}
/** 정해진 ID의 앱 사용자(로그인 발급 없이 바로 넣는다). 비교군 배정이 ID 끝 두 글자로 정해져서 쓴다. */
async function bare(suffix: string, createdDaysAgo: number, seenDaysAgo: number) {
  const profileId = `prf_00000000-0000-0000-0000-0000000000${suffix}`;
  await run(
    `INSERT INTO profiles (id, settings_json, created_at, last_seen_at, google_sub) VALUES (?, '{}', ?, ?, ?)`,
    profileId,
    iso(NOW - createdDaysAgo * DAY),
    iso(NOW),
    `sub-${profileId}`,
  );
  await addAppPushDevice(ctx, profileId);
  await run(
    'UPDATE push_devices SET updated_at=? WHERE profile_id=?',
    iso(NOW - seenDaysAgo * DAY),
    profileId,
  );
  return { profileId };
}
async function activity(
  who: { cookie: string; profileId: string },
  state: string,
  seenDaysAgo: number,
  lang = 'ko',
) {
  const response = await callJson(
    { ...ctx.env, ENVIRONMENT: 'local' },
    'PUT',
    '/v1/career-activity',
    {
      cookie: who.cookie,
      body: { careerId: crypto.randomUUID(), state },
    },
  );
  expect(response.status).toBe(204);
  await run(
    'UPDATE career_activity SET last_active_at=?, lang=? WHERE profile_id=?',
    iso(NOW - seenDaysAgo * DAY),
    lang,
    who.profileId,
  );
}
const transport = () =>
  vi.fn(async (_url: string | URL | Request, init?: RequestInit) =>
    Response.json({
      data: JSON.parse(String(init?.body)).map((_: unknown, i: number) => ({
        status: 'ok',
        id: `ticket_${i}`,
      })),
    }),
  );
const sent = (send: ReturnType<typeof transport>) =>
  send.mock.calls.flatMap((c) => JSON.parse(String(c[1]!.body)) as Record<string, unknown>[]);

describe('T-11-501 쉬는 사람 사다리', () => {
  it('3일 쉰 사람에게 12시대 한 번 쌓고, 같은 쉬기에는 다시 쌓지 않는다', async () => {
    const who = await person(20, 3.2);
    await activity(who, 'active', 3.2);
    expect(await queueRetentionPushes(ctx.env, NOW)).toMatchObject({ created: 1, holdout: 0 });
    expect(await queueRetentionPushes(ctx.env, NOW + 5 * 60_000)).toMatchObject({ created: 0 });
    const [n] = await rows('notifications');
    expect(n).toMatchObject({
      profile_id: who.profileId,
      kind: 'return',
      title: ko.career.title,
      target_json: '{"type":"screen","screen":"home"}',
    });
    expect(String(n!.source_key)).toMatch(new RegExp(`^retention:lapsed:3:${who.profileId}:`));
    const [ledger] = await rows('retention_pushes');
    expect(ledger).toMatchObject({
      campaign: 'lapsed',
      stage: 3,
      story: 'career',
      variant: 'send',
      notification_id: n!.id,
    });
    const [delivery] = await rows('push_deliveries');
    expect(delivery).toMatchObject({ expires_at: '2026-10-28T10:00:00.000Z' });

    const send = transport();
    await runPersonalPush(ctx.env, NOW, send);
    expect(sent(send)[0]).toMatchObject({
      title: ko.career.title,
      data: { campaign: 'retention_lapsed', reminderStage: 3 },
    });
  });

  it('3일 쉰 뒤 7일이 되면 다음 단계를 보내고, 다시 오면 새 사다리가 된다', async () => {
    const who = await person(30, 3.2);
    await queueRetentionPushes(ctx.env, NOW);
    await queueRetentionPushes(ctx.env, NOW + 4 * DAY);
    expect((await rows('retention_pushes')).map((r) => r.stage)).toEqual([3, 7]);
    // 다시 와서(기기 갱신) 3일 쉬면 lapse_key가 바뀌어 3일째부터 다시 시작한다.
    await run(
      'UPDATE push_devices SET updated_at=? WHERE profile_id=?',
      iso(NOW + 4.9 * DAY),
      who.profileId,
    );
    await queueRetentionPushes(ctx.env, NOW + 8 * DAY);
    expect((await rows('retention_pushes')).map((r) => r.stage)).toEqual([3, 7, 3]);
  });

  it('그 사이 생긴 일: 판매가 있으면 판매, 없고 랭크 경기가 있으면 승무패를 쓴다', async () => {
    const seller = await person(30, 4);
    const owner = await person(30, 4);
    const rival = await person(30, 0);
    const since = iso(NOW - 2 * DAY);
    await run(
      `INSERT INTO market_listings (id, career_id, seller_id, season, price, status, created_at, closed_at)
       VALUES ('l1','c1',?,0,1000,'sold',?,?), ('l2','c2',?,0,1000,'sold',?,?)`,
      seller.profileId,
      since,
      since,
      seller.profileId,
      since,
      since,
    );
    for (const [id, p] of [
      ['t-owner', owner.profileId],
      ['t-rival', rival.profileId],
    ] as const)
      await run(
        `INSERT INTO owner_teams (id,profile_id,season,name,formation,slots_json,filled,ovr,rating,created_at,updated_at)
         VALUES (?,?,0,?,'4-3-3','[]',0,80,1000,?,?)`,
        id,
        p,
        id,
        since,
        since,
      );
    for (const [i, home, away] of [
      [1, 2, 1],
      [2, 1, 1],
      [3, 0, 2],
    ] as const)
      await run(
        `INSERT INTO team_matches (id,profile_id,home_team_id,away_team_id,home_goals,away_goals,detail_json,created_at)
         VALUES (?,?, 't-rival','t-owner',?,?,'{}',?)`,
        `m${i}`,
        rival.profileId,
        home,
        away,
        since,
      );
    await queueRetentionPushes(ctx.env, NOW);
    const byProfile = Object.fromEntries(
      (await rows('notifications')).map((n) => [n.profile_id, n]),
    );
    expect(byProfile[seller.profileId]).toMatchObject({
      title: '쉬는 동안 선수 2명이 팔렸어요',
      target_json: '{"type":"screen","screen":"market"}',
    });
    expect(byProfile[owner.profileId]).toMatchObject({
      title: '쉬는 동안 랭크 경기 3번을 치렀어요',
      body: '1승 1무 1패예요. 내 팀 최근 경기에서 결과를 볼 수 있어요.',
    });
    expect(byProfile[rival.profileId]).toBeUndefined();
    expect(pushText(String(byProfile[owner.profileId]!.body), 'en')).toBe(
      '1W 1D 1L. See the results in your team’s recent matches.',
    );
    expect(pushText(String(byProfile[seller.profileId]!.title), 'ja')).toBe(
      '休んでいる間に選手が2人売れました',
    );
  });

  it('30일째 인사로 끝내고, 45일 넘게 쉰 사람 · 독려 알림을 끈 사람 · 같은 날 다른 독려를 받은 사람은 건너뛴다', async () => {
    const farewell = await person(60, 31);
    await person(90, 50);
    const off = await person(30, 5);
    await run(
      `INSERT INTO push_preferences (profile_id, notice, release, team, market, social, nudge)
       VALUES (?,1,1,1,1,1,0)`,
      off.profileId,
    );
    const busy = await person(30, 5);
    await run(
      `INSERT INTO notifications (id, profile_id, source_key, kind, title, body, target_json, created_at, expires_at)
       VALUES ('ntf_busy', ?, 'attendance-reminder:x', 'return', 't', 'b', '{"type":"screen","screen":"home"}', ?, ?)`,
      busy.profileId,
      iso(NOW - 60_000),
      iso(NOW + DAY),
    );
    await queueRetentionPushes(ctx.env, NOW);
    const ledger = await rows('retention_pushes');
    expect(ledger.map((r) => [r.profile_id, r.stage, r.story])).toEqual([
      [farewell.profileId, 30, 'farewell'],
    ]);
  });

  it('12시대가 아니거나 · 시즌 개막일이거나 · 꺼져 있으면 쌓지 않는다', async () => {
    await person(30, 5);
    expect(await queueRetentionPushes(ctx.env, NOW + 2 * 3600_000)).toMatchObject({ created: 0 });
    expect(await queueRetentionPushes({ ...ctx.env, RETENTION_PUSH_ENABLED: '0' }, NOW)).toEqual({
      enabled: false,
    });
    expect(await queueRetentionPushes({ ...ctx.env, ENVIRONMENT: 'staging' }, NOW)).toEqual({
      enabled: false,
    });
    expect(seasonOpeningDay(Date.parse('2026-10-06T03:00:00.000Z'))).toBe(true);
    expect(seasonOpeningDay(NOW)).toBe(false);
    expect(await rows('retention_pushes')).toHaveLength(0);
  });

  it('보내기 전에 돌아왔으면 보내지 않는다', async () => {
    const who = await person(30, 5);
    await queueRetentionPushes(ctx.env, NOW);
    await run(
      'UPDATE push_devices SET updated_at=? WHERE profile_id=?',
      iso(NOW + 60_000),
      who.profileId,
    );
    const send = transport();
    await runPersonalPush(ctx.env, NOW + 2 * 60_000, send);
    expect(send).not.toHaveBeenCalled();
  });

  it('커리어 언어로 보낸다', async () => {
    const who = await person(30, 5);
    await activity(who, 'active', 5, 'ja');
    await queueRetentionPushes(ctx.env, NOW);
    const send = transport();
    await runPersonalPush(ctx.env, NOW, send);
    expect(sent(send)[0]).toMatchObject({ title: ja.career.title, body: ja.career.body });
  });
});

describe('T-11-501 첫 주 다음 할 일', () => {
  it('가입 7일 안, 하루 넘게 오지 않은 사람에게 지금 단계 하나를 보낸다', async () => {
    const fresh = await person(2, 1.5, false);
    const playing = await person(3, 1.5);
    await activity(playing, 'active', 1.5);
    await person(2, 0.2); // 오늘 왔다
    await queueRetentionPushes(ctx.env, NOW);
    const ledger = Object.fromEntries(
      (await rows('retention_pushes')).map((r) => [r.profile_id, r]),
    );
    expect(Object.keys(ledger)).toHaveLength(2);
    expect(ledger[fresh.profileId]).toMatchObject({
      campaign: 'onboarding',
      stage: 1,
      story: 'create',
      lapse_key: 'signup',
    });
    expect(ledger[playing.profileId]).toMatchObject({ stage: 2, story: 'retire' });
  });

  it('단계마다 한 번, 최대 3번이고 넘어가면 progressed_at을 적는다', async () => {
    const who = await person(1.5, 1.2, false);
    await queueRetentionPushes(ctx.env, NOW);
    await queueRetentionPushes(ctx.env, NOW + DAY);
    expect(await rows('retention_pushes')).toHaveLength(1);
    // 선수를 만들고 하루 넘게 쉬면 다음 단계(은퇴)를 보낸다.
    await activity(who, 'active', 0);
    await run('UPDATE career_activity SET last_active_at=?', iso(NOW + 0.5 * DAY));
    await measureRetention(ctx.env, NOW + 0.6 * DAY);
    const [first] = await rows('retention_pushes');
    expect(first).toMatchObject({ stage: 1 });
    expect(first!.progressed_at).not.toBeNull();
    expect(first!.returned_at).not.toBeNull();
    await queueRetentionPushes(ctx.env, NOW + 2 * DAY);
    expect((await rows('retention_pushes')).map((r) => r.stage)).toEqual([1, 2]);
  });
});

describe('T-11-501 비교군과 하루 하나', () => {
  it('비교군 기간에는 약 10%를 알림 없이 원장에만 남기고, 끝나면 모두 보낸다', async () => {
    const held = await bare('19', 30, 5);
    await bare('1a', 30, 5);
    await bare('ff', 30, 5);
    const env = { ...ctx.env, RETENTION_HOLDOUT_UNTIL: iso(NOW + 14 * DAY) };
    await queueRetentionPushes(env, NOW);
    const ledger = await rows('retention_pushes');
    const mine = ledger.find((r) => r.profile_id === held!.profileId)!;
    expect(mine).toMatchObject({ variant: 'holdout', notification_id: null });
    const notified = new Set((await rows('notifications')).map((n) => n.profile_id));
    expect(notified.has(held!.profileId)).toBe(false);
    for (const r of ledger)
      expect(r.variant).toBe(inHoldout(String(r.profile_id)) ? 'holdout' : 'send');
    expect(notified.size).toBe(ledger.filter((r) => r.variant === 'send').length);
    expect(inHoldout('prf_00000000-0000-0000-0000-000000000019')).toBe(true);
    expect(inHoldout('prf_00000000-0000-0000-0000-00000000001a')).toBe(false);
  });

  it('점심에 리텐션 푸시를 받은 사람은 저녁 출석 독려를 받지 않는다', async () => {
    const who = await person(30, 5);
    await queueRetentionPushes(ctx.env, NOW);
    expect(await queueAttendanceReminders(ctx.env, NOW + 7 * 3600_000)).toEqual({ created: 0 });
    const other = await person(30, 1);
    expect(await queueAttendanceReminders(ctx.env, NOW + 7 * 3600_000)).toEqual({ created: 1 });
    expect((await rows('notifications')).map((n) => n.profile_id)).toEqual([
      who.profileId,
      other.profileId,
    ]);
  });
});

describe('T-11-501 운영 도구 집계', () => {
  it('캠페인 · 단계마다 보낸 쪽과 비교군의 복귀를 따로 센다', async () => {
    const people = [];
    for (const suffix of ['00', '0a', '19', '1a', '40', '80', 'c0', 'ff'])
      people.push(await bare(suffix, 30, 5));
    await queueRetentionPushes({ ...ctx.env, RETENTION_HOLDOUT_UNTIL: iso(NOW + 14 * DAY) }, NOW);
    await run('UPDATE push_devices SET updated_at=?', iso(NOW + DAY));
    await measureRetention(ctx.env, NOW + 2 * DAY);
    const result = await getPushPerformance(
      ctx.env.DB,
      { days: '7', page: 0 },
      new Date(NOW + 2 * DAY),
    );
    const held = people.filter((p) => inHoldout(p.profileId)).length;
    expect(result.nudges).toEqual([
      {
        campaign: 'lapsed',
        stage: 3,
        sent: people.length - held,
        held,
        delivered: 0,
        clicked: 0,
        sentReturned: people.length - held,
        heldReturned: held,
        sentProgressed: 0,
        heldProgressed: 0,
      },
    ]);
  });
});

describe('T-11-501 단계와 이야기', () => {
  it('쉰 날로 단계를 고른다', () => {
    expect([2.9, 3, 6.9, 7, 13, 14, 29, 30, 44].map(lapsedStage)).toEqual([
      null,
      3,
      3,
      7,
      7,
      14,
      14,
      30,
      30,
    ]);
  });
  it('14일은 새 시즌을, 30일은 인사를 먼저 고른다', () => {
    const quiet = { career: 0, sold: 0, matches: null };
    expect(lapsedStory(14, quiet, 2)).toEqual({ story: 'season', params: { season: 2 } });
    expect(lapsedStory(14, { ...quiet, sold: 3 }, null)).toEqual({ story: 'news', params: {} });
    expect(lapsedStory(7, { ...quiet, career: 1 }, 2)).toEqual({ story: 'career', params: {} });
    expect(lapsedStory(30, { ...quiet, sold: 3 }, 2)).toEqual({ story: 'farewell', params: {} });
  });
  it('모든 문구는 영어 · 일본어로 되읽힌다', () => {
    const params = { n: 4, w: 2, d: 1, l: 1, season: 2 };
    const fill = (t: string) =>
      t.replace(/\{(\w+)\}/g, (_, k: keyof typeof params) => String(params[k]));
    for (const story of Object.keys(ko) as (keyof typeof ko)[])
      for (const part of ['title', 'body'] as const) {
        expect(pushText(fill(ko[story][part]), 'en')).toBe(fill(en[story][part]));
        expect(pushText(fill(ko[story][part]), 'ja')).toBe(fill(ja[story][part]));
      }
  });
});
