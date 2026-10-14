import { cupFinalAt, planNextCup, type CupDef } from '@offside/contracts/cup';
import { SERVICE_SEASONS, teamSeasonAt } from '@offside/contracts/service-seasons';
import { createDb, type Db } from '../db/client.js';
import { cupKo, cupTitle } from '../cupText.js';
import type { Bindings } from '../env.js';
import { cupSchedule } from './cupSchedule.js';

// T-11-251 오프사이드 컵 자동 운영. 5분 cron이 runCup 뒤에 부른다.
// 1) 마지막 대회 결승이 끝나면 다음 회차를 만든다(접수는 결승 10분 뒤). app_meta `cup:autopilot` = 'off'면 만들지 않는다.
// 2) 접수가 열리면 참가 자격이 있는 구단주에게 한 번 알린다(source_key cup-open:<id>, 컵 알림이라 22시까지 푸시).
// 3) 추첨·경기·종료·다음 회차가 30분 넘게 밀리면 운영 슬랙에 한 번 알린다.

export const CUP_AUTOPILOT_KEY = 'cup:autopilot';
const MIN = 60_000;
const OPEN_NOTICE_WINDOW_MS = 2 * 60 * MIN;
const STALL_MS = 30 * MIN;
// 운영 슬랙 문장(운영 도구처럼 한국어로 둔다).
const STALL_TEXT = {
  match: (id: string, round: string) => `${id} ${round} 경기가 30분 넘게 안 치러졌어요`, // i18n-ignore
  draw: (id: string) => `${id} 추첨이 30분 넘게 밀렸어요`, // i18n-ignore
  done: (id: string) => `${id} 결승 뒤 30분이 지나도 대회가 안 끝났어요`, // i18n-ignore
  next: (id: string) => `${id} 다음 회차가 만들어지지 않았어요`, // i18n-ignore
  head: ':warning: 오프사이드 컵 자동 진행 점검', // i18n-ignore
};

/** 다음 회차 일정과 시즌. 결승 뒤 접수가 앞 대회 시즌 안에 다 들어가지 않으면 다음 시즌 개막일 21:10으로 미룬다. */
export function nextCupFor(prev: CupDef): CupDef | null {
  const fit = (draft: CupDef) => {
    const season = teamSeasonAt(draft.opensAt);
    return season !== null && teamSeasonAt(cupFinalAt(draft)) === season
      ? { ...draft, id: `s${season}-${draft.edition}`, season }
      : null;
  };
  const draft = planNextCup(prev);
  const same = fit(draft);
  if (same) return same;
  const next = SERVICE_SEASONS.find((s) => s.startsAt > draft.opensAt);
  if (!next) return null;
  const day = new Date(Date.parse(next.startsAt) + 9 * 3600_000).toISOString().slice(0, 10);
  let opensAt = new Date(`${day}T21:10:00+09:00`).toISOString();
  if (opensAt < next.startsAt)
    opensAt = new Date(Date.parse(opensAt) + 24 * 60 * MIN).toISOString();
  return fit(planNextCup(prev, opensAt));
}

/** 마지막 대회가 끝났고 다음 회차가 없으면 만든다. 만든 대회를 돌려준다. */
export async function scheduleNextCup(db: Db, now: string, all?: CupDef[]) {
  const cups = all ?? (await cupSchedule(db));
  const last = cups.at(-1);
  if (!last || now < cupFinalAt(last)) return null;
  const d1 = db.$client;
  const done = await d1
    .prepare(
      `SELECT (SELECT done_at FROM cup_state WHERE cup_id = ?) AS done,
        (SELECT value FROM app_meta WHERE key = ?) AS mode`,
    )
    .bind(last.id, CUP_AUTOPILOT_KEY)
    .first<{ done: string | null; mode: string | null }>();
  if (!done?.done || done.mode === 'off') return null;
  const cup = nextCupFor(last);
  if (!cup) return null;
  // 겹친 cron·관리자 생성은 id(PK)와 '더 늦은 대회 없음' 조건이 막는다.
  const res = await d1
    .prepare(
      `INSERT OR IGNORE INTO cups
        (id, season, edition, opens_at, closes_at, draw_at, rounds_json, capacity, min_filled, created_at)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
       WHERE NOT EXISTS (SELECT 1 FROM cups WHERE opens_at > ? OR edition >= ?)`,
    )
    .bind(
      cup.id,
      cup.season,
      cup.edition,
      cup.opensAt,
      cup.closesAt,
      cup.drawAt,
      JSON.stringify(cup.rounds),
      cup.capacity,
      cup.minFilled,
      now,
      last.opensAt,
      cup.edition,
    )
    .run();
  return res.meta.changes ? cup : null;
}

export const cupOpenSource = (cupId: string) => `cup-open:${cupId}`;

/**
 * 접수가 열린 대회를 그 시즌 팀이 있는(선발 minFilled자리 이상) 구단주에게 알린다. app_meta 표시가 처음 들어갈 때만
 * 알림·푸시 대기열을 만든다(한 batch). 푸시는 5분 cron의 개인 푸시 발송이 보낸다.
 */
export async function announceCupOpen(db: Db, now: string, all?: CupDef[]) {
  const cups = (all ?? (await cupSchedule(db))).filter(
    (c) =>
      c.opensAt <= now &&
      now < c.closesAt &&
      Date.parse(now) - Date.parse(c.opensAt) < OPEN_NOTICE_WINDOW_MS,
  );
  const d1 = db.$client;
  const sent: string[] = [];
  for (const cup of cups) {
    const source = cupOpenSource(cup.id);
    const results = await d1.batch([
      d1.prepare('INSERT OR IGNORE INTO app_meta (key, value) VALUES (?, ?)').bind(source, now),
      d1
        .prepare(
          `INSERT OR IGNORE INTO notifications
        (id, profile_id, source_key, kind, title, body, target_json, created_at, expires_at)
        SELECT 'ntf_' || lower(hex(randomblob(16))), p.id, ?, 'team', ?, ?,
          '{"type":"screen","screen":"home"}', ?, ?
        FROM owner_teams t JOIN profiles p ON p.id = t.profile_id
        WHERE changes() > 0 AND t.season = ? AND t.filled >= ? AND p.deleted_at IS NULL`,
        )
        .bind(
          source,
          cupKo('openTitle', { cup: cupTitle(cup) }),
          cupKo('openBody', { n: cup.capacity }),
          now,
          cup.closesAt,
          cup.season,
          cup.minFilled,
        ),
      // 결과 푸시(cupResultStatements)와 같은 규칙: 계정마다 최근 앱 기기 하나, 팀 알림을 끈 사람은 뺀다.
      d1
        .prepare(
          `INSERT OR IGNORE INTO push_deliveries
        (id, notification_id, installation_hash, session_id, profile_id, token, due_at, expires_at, updated_at)
        SELECT n.id || ':' || d.installation_hash, n.id, d.installation_hash, d.session_id, d.profile_id,
          d.token, ?, ?, ? FROM notifications n JOIN push_devices d ON d.profile_id=n.profile_id
        LEFT JOIN push_preferences pref ON pref.profile_id=n.profile_id
        WHERE changes()>0 AND n.source_key=? AND n.created_at=? AND COALESCE(pref.team,1)=1
          AND d.installation_hash=(SELECT latest.installation_hash FROM push_devices latest
            JOIN sessions s ON s.id=latest.session_id WHERE latest.profile_id=n.profile_id
              AND s.profile_id=latest.profile_id AND s.channel='app' AND s.revoked_at IS NULL
              AND s.expires_at>? AND latest.updated_at>=?
            ORDER BY latest.updated_at DESC, latest.installation_hash DESC LIMIT 1)`,
        )
        .bind(
          now,
          new Date(Date.parse(now) + 24 * 60 * MIN).toISOString(),
          now,
          source,
          now,
          now,
          new Date(Date.parse(now) - 90 * 24 * 60 * MIN).toISOString(),
        ),
    ]);
    if (results[0]!.meta.changes) sent.push(`${cup.id}:${results[1]!.meta.changes}`);
  }
  return sent;
}

/** 밀린 단계(사람이 볼 문장). 정상이면 빈 배열. key는 같은 문제를 한 번만 알리는 데 쓴다. */
export async function cupStalls(db: Db, now: string, all?: CupDef[]) {
  const cups = all ?? (await cupSchedule(db));
  const late = new Date(Date.parse(now) - STALL_MS).toISOString();
  const d1 = db.$client;
  const [states, matches] = await d1.batch<{ id: string; done: string | null; round?: string }>([
    d1.prepare('SELECT cup_id AS id, done_at AS done FROM cup_state'),
    d1
      .prepare(
        `SELECT cup_id AS id, round, NULL AS done FROM cup_matches
       WHERE played_at IS NULL AND at <= ? GROUP BY cup_id, round`,
      )
      .bind(late),
  ]);
  const stateOf = new Map(states!.results.map((r) => [r.id, r.done]));
  const out: { key: string; text: string }[] = [];
  for (const m of matches!.results)
    out.push({ key: `match:${m.id}:${m.round}`, text: STALL_TEXT.match(m.id, m.round!) });
  for (const cup of cups) {
    if (cup.drawAt <= late && !stateOf.has(cup.id))
      out.push({ key: `draw:${cup.id}`, text: STALL_TEXT.draw(cup.id) });
    if (cupFinalAt(cup) <= late && stateOf.has(cup.id) && !stateOf.get(cup.id))
      out.push({ key: `done:${cup.id}`, text: STALL_TEXT.done(cup.id) });
  }
  const last = cups.at(-1);
  if (last && cupFinalAt(last) <= late && stateOf.get(last.id))
    out.push({ key: `next:${last.id}`, text: STALL_TEXT.next(last.id) });
  return out;
}

/** 밀린 단계를 운영 슬랙(결제 알림과 같은 채널)에 문제마다 한 번 알린다. 끄려면 app_meta `cup:autopilot` = 'off'. */
export async function alertCupStalls(env: Bindings, db: Db, now: string, all?: CupDef[]) {
  const stalls = await cupStalls(db, now, all);
  if (!stalls.length || !env.BILLING_SLACK_WEBHOOK || env.ENVIRONMENT !== 'production') return [];
  const url = new URL(env.BILLING_SLACK_WEBHOOK);
  if (url.origin !== 'https://hooks.slack.com' || !url.pathname.startsWith('/services/')) return [];
  const d1 = db.$client;
  const fresh: string[] = [];
  for (const s of stalls) {
    const res = await d1
      .prepare('INSERT OR IGNORE INTO app_meta (key, value) VALUES (?, ?)')
      .bind(`cup-alert:${s.key}`, now)
      .run();
    if (res.meta.changes) fresh.push(s.text);
  }
  if (!fresh.length) return [];
  const text = [STALL_TEXT.head, ...fresh.map((t) => `• ${t}`)].join('\n');
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`cup alert rejected ${response.status}`);
  return fresh;
}

/** 5분 cron 진입점. 대회 목록은 한 번만 읽고, 다음 회차가 생기면 그 목록으로 접수 알림을 본다. */
export async function runCupAutopilot(env: Bindings, scheduledTime: number) {
  const db = createDb(env.DB);
  const now = new Date(scheduledTime).toISOString();
  const all = await cupSchedule(db);
  const created = await scheduleNextCup(db, now, all);
  if (created) all.push(created);
  const opened = await announceCupOpen(db, now, all);
  const alerted =
    new Date(scheduledTime).getUTCMinutes() % 15 === 0
      ? await alertCupStalls(env, db, now, all)
      : [];
  if (created || opened.length || alerted.length)
    console.log(
      JSON.stringify({
        level: 'info',
        job: 'cup-autopilot',
        created: created?.id ?? null,
        opened,
        alerted: alerted.length,
      }),
    );
  return { created, opened, alerted };
}
