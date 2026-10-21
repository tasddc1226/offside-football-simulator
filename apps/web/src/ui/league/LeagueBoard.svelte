<script lang="ts">
  // T-11-418b 리그 하나: 순위표(승격권 · 강등권 · 기권 수)와 라운드별 경기. 끝난 경기는 스코어를 눌러 상세를 연다.
  // T-11-418d 확정 배지(우승 · 승격 · 잔류 · 강등), 리그 기록(득점 순위 · 최다 연승 · 최장 무패), 마지막 라운드 동시 중계.
  import { onMount } from 'svelte';
  import { fetchLeagueTable, type LeagueMatch, type LeagueTableResponse } from '@offside/app-core/api/league';
  import { cupText as C } from '@offside/app-core/i18n/ko/cup';
  import { leagueText as L } from '@offside/app-core/i18n/ko/league';
  import { playerName } from '@offside/app-core/format';
  import {
    leagueClinches,
    leagueFinalReady,
    leagueMatchMid,
    leagueRecords,
    leagueRound,
    leagueZone,
    type LeagueClinch,
  } from '@offside/app-core/leagueView';
  import { LEAGUE_ROUNDS } from '@offside/contracts/league';
  import LoadState, { type LoadStatus } from '../LoadState.svelte';
  import TeamLogo from '../team/TeamLogo.svelte';
  import LeagueFinalLive from './LeagueFinalLive.svelte';

  let { season, tier, league, bottomTier, mineId, round = $bindable(), onopen }: {
    season: number;
    tier: number;
    league: number;
    bottomTier: number;
    mineId: string | null;
    round: number;
    onopen: (m: LeagueMatch, table: LeagueTableResponse) => void;
  } = $props();

  let status = $state<LoadStatus>('loading');
  let table = $state<LeagueTableResponse | null>(null);

  async function load() {
    status = 'loading';
    const r = await fetchLeagueTable(season, tier, league);
    if (!r.ok) return (status = 'error');
    table = r.data;
    status = 'ready';
  }
  onMount(() => void load());

  const teams = $derived(new Map((table?.teams ?? []).map((t) => [t.teamId, t])));
  const rows = $derived([...(table?.standings ?? [])].sort((a, b) => a.rank - b.rank));
  const day = $derived(table ? leagueRound(table, round) : null);
  const gd = (gf: number, ga: number) => (gf - ga > 0 ? `+${gf - ga}` : String(gf - ga));
  const name = (id: string) => teams.get(id)?.name ?? C.tbd;
  const clinches = $derived(table ? leagueClinches(table, tier, bottomTier) : new Map<string, LeagueClinch>());
  const CLINCH: Record<LeagueClinch, { text: string; cls: string }> = {
    champion: { text: L.clinchChampion, cls: 'good' },
    up: { text: L.clinchUp, cls: 'good' },
    safe: { text: L.clinchSafe, cls: '' },
    down: { text: L.clinchDown, cls: 'warn' },
  };
  const records = $derived(table ? leagueRecords(table) : null);
  const scorers = $derived(table?.scorers ?? []);
  const finalReady = $derived(!!table && leagueFinalReady(table));
  let live = $state(false);
</script>

<LoadState {status} failText={L.tableFail} retry={load} rows={8}>
  {#if table}
    <section class="card lg-sec" data-league-table={`${tier}-${league}`}>
      <h2>{L.standingsTitle}</h2>
      <div class="lg-scroll">
        <table class="lg-table">
          <thead>
            <tr><th class="t">{C.thTeam}</th><th>{C.thP}</th><th>{C.thW}</th><th>{C.thD}</th><th>{C.thL}</th><th>{C.thGd}</th><th>{C.thPts}</th></tr>
          </thead>
          <tbody>
            {#each rows as s (s.teamId)}
              {@const t = teams.get(s.teamId)}
              {@const zone = leagueZone(s.rank, rows.length, tier, bottomTier)}
              {@const cl = clinches.get(s.teamId)}
              <tr class:up={zone === 'up'} class:down={zone === 'down'} class:mine={s.teamId === mineId} data-league-rank={s.rank}>
                <td class="t">
                  <div class="lg-who">
                    <span class="rk">{s.rank}</span>
                    <TeamLogo logo={t?.logo} name={t?.name ?? C.tbd} size={24} decorative />
                    <span class="lg-nm"><b>{t?.name ?? C.tbd}{#if cl}<span class="pill lg-clinch {CLINCH[cl].cls}" data-league-clinch={cl}>{CLINCH[cl].text}</span>{/if}</b><small class="muted">{C.teamOwnerLabel} {t?.owner ?? C.tbd}{#if s.forfeits} · {L.forfeitsTag({ n: s.forfeits })}{/if}</small></span>
                  </div>
                </td>
                <td>{s.p}</td><td>{s.w}</td><td>{s.d}</td><td>{s.l}</td><td>{gd(s.gf, s.ga)}</td><td><b>{s.pts}</b></td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <p class="muted fs-xs lg-legend">
        {#if tier > 1}<span class="lg-key up"></span>{L.zoneUp}{/if}
        {#if tier < bottomTier}<span class="lg-key down"></span>{L.zoneDown}{/if}
        <span>{L.ruleMove}</span>
        {#if clinches.size}<span>{L.clinchNote}</span>{/if}
      </p>
    </section>

    <section class="card lg-sec" data-league-rounds>
      <div class="lg-head">
        <h2>{L.roundsTitle}</h2>
        <label class="lg-pick">
          <span class="sr-only">{L.roundsTitle}</span>
          <select bind:value={round} data-league-round>
            {#each Array.from({ length: LEAGUE_ROUNDS }, (_, i) => i + 1) as n (n)}<option value={n}>{L.roundName({ n })}</option>{/each}
          </select>
        </label>
      </div>
      {#if day}
        <ul class="lg-matches">
          {#each day.matches as m (m.id)}
            <li class:mine={m.homeTeamId === mineId || m.awayTeamId === mineId} data-league-match={m.id}>
              <span class="lg-side">{name(m.homeTeamId)}</span>
              {#if m.played && !m.forfeit}
                <button class="lg-mid lg-open" data-act="league-match-open" onclick={() => onopen(m, table!)}>{leagueMatchMid(m)}</button>
              {:else}
                <span class="lg-mid">{leagueMatchMid(m)}{#if m.forfeit}<small class="pill warn">{L.forfeitScore}</small>{/if}</span>
              {/if}
              <span class="lg-side away">{name(m.awayTeamId)}</span>
            </li>
          {/each}
        </ul>
        {#each day.resting as t (t.teamId)}<p class="muted fs-sm" data-league-rest>{L.restTeam({ team: t.name })}</p>{/each}
      {/if}
      {#if round === LEAGUE_ROUNDS && finalReady}
        <button class="btn btn-primary lg-live" data-act="league-final-live" onclick={() => (live = true)}>{L.finalLive}</button>
      {/if}
    </section>

    {#if scorers.length || records?.winStreak || records?.unbeaten}
      <section class="card lg-sec" data-league-records>
        <h2>{L.recordsTitle}</h2>
        {#if scorers.length}
          <h3>{L.topScorers}</h3>
          <ol class="lg-scorers">
            {#each scorers as p, i (i)}
              <li data-league-scorer>
                <span class="nm"><b>{playerName(p.name, p.pos, p.number)}</b><small class="muted">{name(p.teamId)}</small></span>
                <b>{L.goalsN({ n: p.goals })}</b>
              </li>
            {/each}
          </ol>
        {/if}
        <dl class="lg-runs">
          {#if records?.winStreak}<div data-league-run="win"><dt>{L.winStreak}</dt><dd>{L.runValue({ team: name(records.winStreak.teamId), n: records.winStreak.n })}</dd></div>{/if}
          {#if records?.unbeaten}<div data-league-run="unbeaten"><dt>{L.unbeatenRun}</dt><dd>{L.runValue({ team: name(records.unbeaten.teamId), n: records.unbeaten.n })}</dd></div>{/if}
        </dl>
      </section>
    {/if}
    {#if live}<LeagueFinalLive {table} {mineId} onclose={() => (live = false)} />{/if}
  {/if}
</LoadState>

<style>
  .lg-sec { display: flex; flex-direction: column; gap: 10px; }
  .lg-sec h2 { margin: 0; }
  .lg-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .lg-pick select { min-height: 44px; }
  .lg-scroll { overflow-x: auto; }
  .lg-table { width: 100%; min-width: 400px; border-collapse: collapse; font-size: var(--fs-label); font-variant-numeric: tabular-nums; }
  .lg-table th, .lg-table td { padding: 8px 4px; text-align: center; white-space: nowrap; }
  .lg-table th { font-weight: 600; color: var(--muted); font-size: var(--fs-caption); }
  .lg-table .t { min-width: 170px; width: 100%; text-align: left; white-space: normal; }
  .lg-table tbody tr { border-top: 1px solid var(--line); }
  .lg-table tr.up { background: color-mix(in srgb, var(--good) 12%, transparent); box-shadow: inset 3px 0 0 var(--good); }
  .lg-table tr.down { background: color-mix(in srgb, var(--warn) 10%, transparent); box-shadow: inset 3px 0 0 var(--warn); }
  .lg-table tr.mine b { color: var(--accent-text); }
  .lg-who { display: flex; align-items: center; gap: 6px; min-height: 44px; }
  .lg-who .rk { flex: none; width: 1.4em; color: var(--muted); }
  .lg-nm { display: flex; flex-direction: column; gap: 3px; min-width: 0; overflow-wrap: anywhere; }
  .lg-nm small { font-size: 11px; font-weight: 400; }
  .lg-legend { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: 0; }
  .lg-key { display: inline-block; width: 10px; height: 10px; border-radius: 2px; }
  .lg-key.up { background: var(--good); }
  .lg-key.down { background: var(--warn); }
  .lg-matches { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
  .lg-matches li { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 8px; min-height: 44px; border-top: 1px solid var(--line); font-size: var(--fs-body2); }
  .lg-matches li.mine .lg-side { font-weight: 700; }
  .lg-side { min-width: 0; overflow-wrap: anywhere; }
  .lg-side.away { text-align: right; }
  .lg-mid { display: flex; flex-direction: column; align-items: center; gap: 2px; font-family: var(--display); font-weight: 700; font-variant-numeric: tabular-nums; }
  .lg-clinch { margin-left: 6px; vertical-align: middle; }
  .lg-live { min-height: 44px; }
  .lg-sec h3 { margin: 0; font-size: var(--fs-body2); }
  .lg-scorers { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
  .lg-scorers li { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 44px; border-top: 1px solid var(--line); font-size: var(--fs-body2); }
  .lg-scorers .nm { display: flex; flex-direction: column; gap: 2px; min-width: 0; overflow-wrap: anywhere; }
  .lg-scorers small { font-size: 11px; }
  .lg-runs { display: grid; gap: 8px; margin: 0; }
  .lg-runs div { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; }
  .lg-runs dt { color: var(--muted); }
  .lg-runs dd { margin: 0; text-align: right; overflow-wrap: anywhere; }
  .lg-open { min-height: 44px; min-width: 64px; border: 1px solid var(--line); border-radius: 8px; background: transparent; color: inherit; cursor: pointer; }
</style>
