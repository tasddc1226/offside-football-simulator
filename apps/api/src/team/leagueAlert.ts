import type { LeagueDef } from '@offside/contracts/league';
import type { Db } from '../db/client.js';
import type { Bindings } from '../env.js';
import { postStallAlerts } from './cupAutopilot.js';
import { leagueStateOf, playedRounds, tiersOf } from './league.js';
import { currentLeague } from './leagueSchedule.js';

// T-11-445 오프사이드 리그 자동 진행 경보. 5분 cron이 runLeague 뒤 15분마다 부른다. 컵 경보(cupStalls)처럼
// 배치 · 경기 · 라운드 알림 · 결산이 밀리면 운영 슬랙에 문제마다 한 번 알린다(app_meta league-alert:<key>).

const MIN = 60_000;
/** 배치 · 경기는 시각 뒤 30분, 알림 · 결산은 100명씩 나눠 보내므로 1 · 2시간을 기다린다. */
const STALL_MS = 30 * MIN;
const NOTIFY_MS = 60 * MIN;
const DONE_MS = 120 * MIN;
// 운영 슬랙 문장(운영 도구처럼 한국어로 둔다).
const STALL_TEXT = {
  draw: (s: number) => `리그 시즌 ${s} 배치가 30분 넘게 밀렸어요`, // i18n-ignore
  match: (s: number, r: number) => `리그 시즌 ${s} ${r}라운드 경기가 30분 넘게 안 치러졌어요`, // i18n-ignore
  notify: (s: number, r: number, n: number) =>
    `리그 시즌 ${s} ${r ? `${r}라운드 결과` : '배치 결과'} 알림이 1시간 넘게 ${n}명에게 안 나갔어요`, // i18n-ignore
  done: (s: number) => `리그 시즌 ${s} 마지막 라운드 뒤 2시간이 지나도 결산 · 알림이 안 끝났어요`, // i18n-ignore
  head: ':warning: 오프사이드 리그 자동 진행 점검', // i18n-ignore
};

const before = (now: string, ms: number) => new Date(Date.parse(now) - ms).toISOString();

/** 밀린 단계(사람이 볼 문장). 정상이면 빈 배열. key는 같은 문제를 한 번만 알리는 데 쓴다. */
export async function leagueStalls(db: Db, league: LeagueDef, now: string) {
  const s = league.season;
  const out: { key: string; text: string }[] = [];
  if (now < league.drawAt) return out;
  const [state] = await leagueStateOf(db, s);
  if (!state) {
    if (league.drawAt <= before(now, STALL_MS))
      out.push({ key: `draw:${s}`, text: STALL_TEXT.draw(s) });
    return out;
  }
  if (state.doneAt || !tiersOf(state).length) return out;
  const d1 = db.$client;
  const late = await d1
    .prepare(
      `SELECT round, COUNT(*) AS n FROM league_matches
       WHERE season = ? AND played_at IS NULL AND at <= ? GROUP BY round ORDER BY round`,
    )
    .bind(s, before(now, STALL_MS))
    .all<{ round: number; n: number }>();
  for (const m of late.results)
    out.push({ key: `match:${s}:${m.round}`, text: STALL_TEXT.match(s, m.round) });
  const played = await playedRounds(db, s);
  const last = league.rounds.at(-1)!;
  if (played === league.rounds.length) {
    if (last <= before(now, DONE_MS)) out.push({ key: `done:${s}`, text: STALL_TEXT.done(s) });
    return out;
  }
  // 마지막 라운드 전: 배치 결과(-1)나 끝난 라운드 결과 알림이 1시간 넘게 남은 구단주.
  const since = played > 0 ? league.rounds[played - 1]! : state.drawnAt;
  if (since <= before(now, NOTIFY_MS)) {
    const row = await d1
      .prepare(
        `SELECT COUNT(*) AS n FROM league_entries
         WHERE season = ? AND status = 'active' AND tier IS NOT NULL AND notified_round < ?`,
      )
      .bind(s, played)
      .first<{ n: number }>();
    if (row?.n)
      out.push({ key: `notify:${s}:${played}`, text: STALL_TEXT.notify(s, played, row.n) });
  }
  return out;
}

/** 지금 리그의 밀린 단계를 운영 슬랙에 알린다. 리그가 없으면 아무것도 하지 않는다. */
export async function alertLeagueStalls(env: Bindings, db: Db, now: string) {
  const league = await currentLeague(db, now);
  if (!league) return [];
  return postStallAlerts(
    env,
    db.$client,
    'league-alert',
    STALL_TEXT.head,
    await leagueStalls(db, league, now),
    now,
  );
}
