import { LEAGUE_ROUNDS, planLeague } from '@offside/contracts/league';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { postStallAlerts } from './cupAutopilot.js';
import { leagueStalls } from './leagueAlert.js';

// T-11-445 리그 자동 진행 경보: 배치 · 경기 · 알림 · 결산이 밀리면 문제마다 한 번 슬랙에 알린다.

const L = planLeague(2, '2026-10-30T15:00:00.000Z');
const at = (iso: string, min: number) => new Date(Date.parse(iso) + min * 60_000).toISOString();

describe('리그 자동 진행 경보 (T-11-445)', () => {
  let ctx: TestD1;
  beforeEach(async () => {
    ctx = await createTestD1();
  });
  afterEach(async () => {
    vi.unstubAllGlobals();
    await ctx.dispose();
  });

  const keys = async (now: string) => (await leagueStalls(ctx.db, L, now)).map((s) => s.key);
  const d1 = () => ctx.env.DB;
  const draw = () =>
    d1()
      .prepare(
        `INSERT INTO league_state (season, seed, tiers_json, drawn_at) VALUES (2, 's', ?, ?)`,
      )
      .bind(JSON.stringify([{ tier: 1, leagues: 1, teams: 2 }]), L.drawAt)
      .run();
  /** 라운드마다 경기 하나. played까지는 치른 경기. */
  const matches = (played: number) =>
    d1().batch(
      L.rounds.map((r, i) =>
        d1()
          .prepare(
            `INSERT INTO league_matches (id, season, tier, league_no, round, slot, home_team_id, away_team_id, at, played_at)
             VALUES (?, 2, 1, 1, ?, 1, 'ta', 'tb', ?, ?)`,
          )
          .bind(`m${i + 1}`, i + 1, r, i < played ? r : null),
      ),
    );
  const entry = (id: string, notified: number) =>
    d1().batch([
      d1()
        .prepare(
          `INSERT INTO profiles (id, settings_json, created_at, last_seen_at) VALUES (?1, '{}', ?2, ?2)`,
        )
        .bind(id, L.opensAt),
      d1()
        .prepare(
          `INSERT INTO league_entries (season, profile_id, status, team_id, tier, league_no, notified_round, created_at, updated_at)
           VALUES (2, ?1, 'active', ?2, 1, 1, ?3, ?4, ?4)`,
        )
        .bind(id, `t-${id}`, notified, L.opensAt),
    ]);

  it('배치 전 · 제때 진행하면 조용하고, 배치가 30분 넘게 안 되면 알린다', async () => {
    expect(await keys(at(L.drawAt, -10))).toEqual([]);
    expect(await keys(at(L.drawAt, 20))).toEqual([]);
    expect(await keys(at(L.drawAt, 31))).toEqual(['draw:2']);
    await draw();
    expect(await keys(at(L.drawAt, 31))).toEqual([]);
  });

  it('경기가 30분 넘게 안 치러지거나 라운드 결과 알림이 1시간 넘게 남으면 알린다', async () => {
    await draw();
    await matches(2);
    await entry('p1', 2);
    await entry('p2', 1);
    // 3라운드 시각 20분 뒤: 아직 조용. 2라운드 알림이 남은 p2는 2라운드 뒤 1시간이 지났으니 알린다.
    expect(await keys(at(L.rounds[2]!, 20))).toEqual(['notify:2:2']);
    expect(await keys(at(L.rounds[2]!, 31))).toEqual(['match:2:3', 'notify:2:2']);
    const [s] = await leagueStalls(ctx.db, L, at(L.rounds[2]!, 31));
    expect(s!.text).toContain('3라운드');
  });

  it('마지막 라운드 뒤 2시간이 지나도 끝나지 않으면 알리고, 끝나면 조용하다', async () => {
    await draw();
    await matches(LEAGUE_ROUNDS);
    const last = L.rounds[LEAGUE_ROUNDS - 1]!;
    expect(await keys(at(last, 60))).toEqual([]);
    expect(await keys(at(last, 121))).toEqual(['done:2']);
    await d1().prepare('UPDATE league_state SET done_at = ? WHERE season = 2').bind(last).run();
    expect(await keys(at(last, 121))).toEqual([]);
  });

  it('운영에서만, 같은 문제는 한 번만 슬랙에 보낸다', async () => {
    const fetcher = vi.fn(async () => new Response('ok'));
    vi.stubGlobal('fetch', fetcher);
    const stalls = [{ key: 'draw:2', text: '배치 밀림' }];
    const now = at(L.drawAt, 31);
    ctx.env.BILLING_SLACK_WEBHOOK = 'https://discord.com/api/webhooks/1/test';
    expect(await postStallAlerts(ctx.env, d1(), 'league-alert', 'head', stalls, now)).toEqual([]);
    ctx.env.ENVIRONMENT = 'production';
    expect(await postStallAlerts(ctx.env, d1(), 'league-alert', 'head', stalls, now)).toEqual([
      '배치 밀림',
    ]);
    expect(await postStallAlerts(ctx.env, d1(), 'league-alert', 'head', stalls, now)).toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const meta = await d1()
      .prepare(`SELECT value FROM app_meta WHERE key = 'league-alert:draw:2'`)
      .first<{ value: string }>();
    expect(meta?.value).toBe(now);
  });
});
