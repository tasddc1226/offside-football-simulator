import {
  CUP_DIVISIONS,
  CUP_DIVISIONS_FROM,
  CUP_SEASON_OPEN_DAYS,
  cupFinalAt,
  cupIdOf,
  divisionCaps,
  editionCups,
  planNextCup,
  type CupDef,
} from '@offside/contracts/cup';
import { SERVICE_SEASONS, teamSeasonAt } from '@offside/contracts/service-seasons';
import { createDb, type Db } from '../db/client.js';
import { cupKo, cupTitle } from '../cupText.js';
import type { Bindings } from '../env.js';
import { cupSchedule } from './cupSchedule.js';

// T-11-251 오프사이드 컵 자동 운영. 5분 cron이 runCup 뒤에 부른다.
// 1) 마지막 대회 결승이 끝나면 다음 회차를 만든다(접수는 결승 10분 뒤). app_meta `cup:autopilot` = 'off'면 만들지 않는다.
// 2) 접수가 열리면 참가 자격이 있는 구단주에게 한 번 알린다(source_key cup-open:<id>, 컵 알림이라 22시까지 푸시).
// 3) 추첨·경기·종료·다음 회차가 30분 넘게 밀리면 운영 슬랙에 한 번 알린다.
// T-11-410 제3회부터는 회차마다 OVR 구간 대회(주니어 · 시니어 · 마스터)를 함께 만들고, 접수가 열릴 때 그 시즌 팀
// OVR 분포로 아랫 구간 상한을 채운다(운영 도구에서 먼저 정했으면 그 값).

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

/**
 * 다음 회차 일정과 시즌. 결승 뒤 접수가 앞 대회 시즌 안에 다 들어가지 않으면 다음 시즌 개막일 21:10으로 미룬다.
 * T-11-410 구간 대회 회차면 개막 CUP_SEASON_OPEN_DAYS일 뒤 21:10(팀 OVR 분포가 생긴 뒤)으로 미루고, 구간마다 대회를 낸다.
 */
export function nextCupsFor(prev: CupDef): CupDef[] {
  const head = nextCupFor(prev);
  if (!head) return [];
  if (head.edition < CUP_DIVISIONS_FROM) return [head];
  return CUP_DIVISIONS.map((division) => ({
    ...head,
    id: cupIdOf(head.season, head.edition, division),
    division,
    ovrMax: null,
  }));
}

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
  const delay = prev.edition + 1 >= CUP_DIVISIONS_FROM ? CUP_SEASON_OPEN_DAYS : 0;
  let opensAt = new Date(Date.parse(`${day}T21:10:00+09:00`) + delay * 24 * 60 * MIN).toISOString();
  if (opensAt < next.startsAt)
    opensAt = new Date(Date.parse(opensAt) + 24 * 60 * MIN).toISOString();
  return fit(planNextCup(prev, opensAt));
}

/** 마지막 회차(구간이 여럿이면 모두)가 끝났고 다음 회차가 없으면 만든다. 만든 대회들을 돌려준다. */
export async function scheduleNextCup(db: Db, now: string, all?: CupDef[]) {
  const cups = all ?? (await cupSchedule(db));
  const last = cups.at(-1);
  if (!last || now < cupFinalAt(last)) return [];
  const lastEdition = editionCups(last, cups);
  const d1 = db.$client;
  const done = await d1
    .prepare(
      `SELECT (SELECT count(*) FROM cup_state WHERE cup_id IN (${lastEdition.map(() => '?').join(', ')})
          AND done_at IS NOT NULL) AS done,
        (SELECT value FROM app_meta WHERE key = ?) AS mode`,
    )
    .bind(...lastEdition.map((c) => c.id), CUP_AUTOPILOT_KEY)
    .first<{ done: number; mode: string | null }>();
  if (!done || done.done < lastEdition.length || done.mode === 'off') return [];
  const next = nextCupsFor(last);
  if (!next.length) return [];
  // 겹친 cron·관리자 생성은 id(PK)와 '더 늦은 회차 없음' 조건이 막는다(같은 회차 구간끼리는 서로 막지 않는다).
  const res = await d1.batch(
    next.map((cup) =>
      d1
        .prepare(
          `INSERT OR IGNORE INTO cups
        (id, season, edition, opens_at, closes_at, draw_at, rounds_json, capacity, min_filled, created_at,
         division, ovr_max)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
       WHERE NOT EXISTS (SELECT 1 FROM cups WHERE (opens_at > ? OR edition >= ?) AND edition <> ?)`,
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
          cup.division ?? null,
          cup.ovrMax ?? null,
          last.opensAt,
          cup.edition,
          cup.edition,
        ),
    ),
  );
  return next.filter((_, i) => res[i]!.meta.changes);
}

/**
 * T-11-410 접수가 열린 구간 대회 중 상한이 비어 있는 아랫 구간을 채운다 — 그 시즌 자격이 되는 팀(선발 minFilled자리
 * 이상) OVR의 1/3 · 2/3 지점(contracts divisionCaps). 운영 도구에서 미리 정했으면 그대로 둔다. 채운 대회 id를 돌려준다.
 */
export async function fillDivisionCaps(db: Db, now: string, all: CupDef[]) {
  const open = all.filter(
    (c) => c.division && c.division !== 'master' && c.ovrMax == null && c.opensAt <= now,
  );
  if (!open.length) return [];
  const d1 = db.$client;
  const head = open[0]!;
  const { results } = await d1
    .prepare('SELECT ovr FROM owner_teams WHERE season = ? AND filled >= ?')
    .bind(head.season, head.minFilled)
    .all<{ ovr: number }>();
  const caps = divisionCaps(results.map((r) => r.ovr));
  const filled: string[] = [];
  for (const cup of open) {
    const cap = caps[CUP_DIVISIONS.indexOf(cup.division!)]!;
    const res = await d1
      .prepare('UPDATE cups SET ovr_max = ? WHERE id = ? AND ovr_max IS NULL')
      .bind(cap, cup.id)
      .run();
    cup.ovrMax = cap;
    if (res.meta.changes) filled.push(`${cup.id}:${cap}`);
  }
  return filled;
}

export const cupOpenSource = (cupId: string) => `cup-open:${cupId}`;

/**
 * 접수가 열린 대회를 그 시즌 팀이 있는(선발 minFilled자리 이상) 구단주에게 알린다. app_meta 표시가 처음 들어갈 때만
 * 알림·푸시 대기열을 만든다(한 batch). 푸시는 5분 cron의 개인 푸시 발송이 보낸다.
 */
export async function announceCupOpen(db: Db, now: string, all?: CupDef[]) {
  // T-11-410 구간 대회는 회차에 한 번(마스터 대회 id로) 알린다.
  const cups = (all ?? (await cupSchedule(db))).filter(
    (c) =>
      (!c.division || c.division === 'master') &&
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
          cupKo('openTitle', { cup: cupTitle({ ...cup, division: null }) }),
          cupKo(cup.division ? 'openBodyDivision' : 'openBody', { n: cup.capacity }),
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
  if (last && cupFinalAt(last) <= late && editionCups(last, cups).every((c) => stateOf.get(c.id)))
    out.push({ key: `next:${last.id}`, text: STALL_TEXT.next(last.id) });
  return out;
}

/**
 * 밀린 단계를 운영 슬랙(결제 알림과 같은 채널)에 문제마다 한 번 알린다. app_meta `<prefix>:<key>`가 한 번만 보내게 막는다.
 * T-11-445 리그 경보도 같이 쓴다.
 */
export async function postStallAlerts(
  env: Bindings,
  d1: D1Database,
  prefix: string,
  head: string,
  stalls: readonly { key: string; text: string }[],
  now: string,
) {
  if (!stalls.length || !env.BILLING_SLACK_WEBHOOK || env.ENVIRONMENT !== 'production') return [];
  const url = new URL(env.BILLING_SLACK_WEBHOOK);
  if (url.origin !== 'https://hooks.slack.com' || !url.pathname.startsWith('/services/')) return [];
  const fresh: string[] = [];
  for (const s of stalls) {
    const res = await d1
      .prepare('INSERT OR IGNORE INTO app_meta (key, value) VALUES (?, ?)')
      .bind(`${prefix}:${s.key}`, now)
      .run();
    if (res.meta.changes) fresh.push(s.text);
  }
  if (!fresh.length) return [];
  const text = [head, ...fresh.map((t) => `• ${t}`)].join('\n');
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`${prefix} rejected ${response.status}`);
  return fresh;
}

/** 컵 밀린 단계를 알린다. 끄려면 app_meta `cup:autopilot` = 'off'. */
export async function alertCupStalls(env: Bindings, db: Db, now: string, all?: CupDef[]) {
  return postStallAlerts(
    env,
    db.$client,
    'cup-alert',
    STALL_TEXT.head,
    await cupStalls(db, now, all),
    now,
  );
}

/** 5분 cron 진입점. 대회 목록은 한 번만 읽고, 다음 회차가 생기면 그 목록으로 접수 알림을 본다. */
export async function runCupAutopilot(env: Bindings, scheduledTime: number) {
  const db = createDb(env.DB);
  const now = new Date(scheduledTime).toISOString();
  const all = await cupSchedule(db);
  const created = await scheduleNextCup(db, now, all);
  all.push(...created);
  const capped = await fillDivisionCaps(db, now, all);
  const opened = await announceCupOpen(db, now, all);
  const alerted =
    new Date(scheduledTime).getUTCMinutes() % 15 === 0
      ? await alertCupStalls(env, db, now, all)
      : [];
  if (created.length || capped.length || opened.length || alerted.length)
    console.log(
      JSON.stringify({
        level: 'info',
        job: 'cup-autopilot',
        created: created.map((c) => c.id),
        capped,
        opened,
        alerted: alerted.length,
      }),
    );
  return { created, capped, opened, alerted };
}
