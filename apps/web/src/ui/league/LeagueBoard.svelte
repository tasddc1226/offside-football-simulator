<script lang="ts">
  // T-11-418b 리그 하나: 순위표(승격권 · 강등권 · 기권 수)와 라운드별 경기. 끝난 경기는 스코어를 눌러 상세를 연다.
  // T-11-418d 확정 배지(우승 · 승격 · 잔류 · 강등), 리그 기록(득점 순위 · 최다 연승 · 최장 무패), 마지막 라운드 동시 중계.
  import { onMount } from 'svelte';
  import { fetchLeagueTable, type LeagueMatch, type LeagueTableResponse } from '@offside/app-core/api/league';
  import { cupText as C } from '@offside/app-core/i18n/ko/cup';
  import { leagueText as L } from '@offside/app-core/i18n/ko/league';
  import { playerName } from '@offside/app-core/format';
  import {
    leagueForfeitsTag,
    leagueClinches,
    leagueLegend,
    leagueRoundAt,
    leagueZoneLabel,
    leagueFinalReady,
    leagueLastRound,
    leagueFixtureRows,
    leagueMyMatches,
    leagueRoundSlots,
    leagueSlotMid,
    leagueRecords,
    leagueRound,
    leagueZone,
    type LeagueClinch,
    type LeagueFixtureRow,
  } from '@offside/app-core/leagueView';
  import LoadState, { type LoadStatus } from '../LoadState.svelte';
  import PopSheet from '../PopSheet.svelte';
  import TeamLogo from '../team/TeamLogo.svelte';
  import LeagueFinalLive from './LeagueFinalLive.svelte';

  let { season, tier, league, bottomTier, mineId, round = $bindable(), thisRound, onopen, onteam }: {
    season: number;
    tier: number;
    league: number;
    bottomTier: number;
    mineId: string | null;
    round: number;
    /** 다음에 치를 라운드. '이번 라운드로'가 여기로 돌아온다. */
    thisRound: number;
    onopen: (m: LeagueMatch, table: LeagueTableResponse) => void;
    onteam: (teamId: string) => void;
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
  const legend = $derived(leagueLegend(tier, bottomTier));
  const roundAt = $derived(day ? leagueRoundAt(day.matches) : null);
  const scorers = $derived(table?.scorers ?? []);
  const finalReady = $derived(!!table && leagueFinalReady(table));
  const lastRound = $derived(table ? leagueLastRound(table) : 0);
  let live = $state(false);
  let fixtures = $state(false);
  const fixtureRows = $derived(table && fixtures ? leagueFixtureRows(table, mineId, thisRound) : []);
  const my = $derived(table ? leagueMyMatches(table, mineId) : null);
  const slots = $derived(day ? leagueRoundSlots(day.matches) : []);
  function pickRound(n: number) {
    round = n;
    fixtures = false;
  }
  /** 끝난 내 경기는 바로 중계를 열고, 나머지는 그 라운드로 옮긴다. */
  function openFixture(f: LeagueFixtureRow) {
    if (f.mine && !f.mine.rest && f.mine.watch && table) {
      fixtures = false;
      onopen(f.mine.watch, table);
    } else pickRound(f.round);
  }
  /** 일정 시트를 열면 이번 라운드가 보이게 내린다. */
  function showNow(el: HTMLElement) {
    // PopSheet가 열리며 맨 위로 올리고 첫 버튼에 초점을 둔 뒤에 내린다.
    const id = setTimeout(() => el.scrollIntoView({ block: 'center' }), 60);
    return { destroy: () => clearTimeout(id) };
  }
</script>

<LoadState {status} failText={L.tableFail} retry={load} rows={8}>
  {#if table}
    {#if my}
      <section class="card lg-sec" data-league-my>
        <h2>{L.myMatchTitle}</h2>
        {#if my.last}
          <div class="lg-my" data-league-my-last>
            <span class="lg-my-who"><small class="muted">{L.myMatchLast} · {L.roundName({ n: my.last.match.round })}</small><span>{my.last.opponent} <small class="muted">{my.last.side}</small></span></span>
            <b class="lg-fx-mid" class:w={my.last.result === 'w'} class:l={my.last.result === 'l'}>{my.last.score}</b>
            {#if my.last.watch}<button class="btn btn-sm lg-my-watch" type="button" data-act="league-my-watch" onclick={() => onopen(my.last!.match, table!)}>{L.myMatchWatch}</button>{/if}
          </div>
        {/if}
        {#if my.next}
          <div class="lg-my" data-league-my-next>
            <span class="lg-my-who"><small class="muted">{L.myMatchNext} · {L.roundName({ n: my.next.match.round })}</small><span>{my.next.opponent} <small class="muted">{my.next.side}</small></span></span>
            <small class="muted lg-my-when">{my.next.when}</small>
          </div>
        {/if}
      </section>
    {/if}

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
              {@const zoneLabel = s.teamId === mineId ? leagueZoneLabel(zone, !!cl) : null}
              <tr class:up={zone === 'up'} class:down={zone === 'down'} class:mine={s.teamId === mineId} data-league-rank={s.rank}>
                <td class="t">
                  <button class="lg-who" type="button" data-act="league-team-open" disabled={!t} onclick={() => onteam(s.teamId)} aria-label={t ? C.teamProfileOpen({ team: t.name }) : undefined}>
                    <span class="rk">{s.rank}</span>
                    <TeamLogo logo={t?.logo} name={t?.name ?? C.tbd} size={24} decorative />
                    <span class="lg-nm"><b>{t?.name ?? C.tbd}{#if cl}<span class="pill lg-clinch {CLINCH[cl].cls}" data-league-clinch={cl}>{CLINCH[cl].text}</span>{/if}{#if zoneLabel}<span class="pill lg-clinch" class:good={zone === 'up'} class:warn={zone === 'down'} data-league-my-zone={zone}>{zoneLabel}</span>{/if}</b><small class="muted">{C.teamOwnerLabel} {t?.owner ?? C.tbd}{#if s.forfeits || s.teamId === mineId}&nbsp;· <span data-league-forfeits={s.teamId === mineId ? 'mine' : undefined}>{leagueForfeitsTag(s.forfeits)}</span>{/if}</small></span>
                  </button>
                </td>
                <td>{s.p}</td><td>{s.w}</td><td>{s.d}</td><td>{s.l}</td><td>{gd(s.gf, s.ga)}</td><td><b>{s.pts}</b></td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <p class="muted fs-xs lg-legend">
        {#if legend.up}<span class="lg-key up"></span>{L.zoneUp}{/if}
        {#if legend.down}<span class="lg-key down"></span>{L.zoneDown}{/if}
        <span data-league-legend>{legend.move}</span>
        {#if clinches.size}<span>{L.clinchNote}</span>{/if}
      </p>
    </section>

    <section class="card lg-sec" data-league-rounds>
      <div class="lg-step">
        <button class="lg-arrow" type="button" data-act="league-round-prev" aria-label={L.roundPrev} disabled={round <= 1} onclick={() => pickRound(round - 1)}>‹</button>
        <div class="lg-now" data-league-round={round}>
          <h2>{L.roundName({ n: round })}</h2>
          {#if roundAt}<small class="muted" data-league-round-at>{roundAt}</small>{/if}
        </div>
        <button class="lg-arrow" type="button" data-act="league-round-next" aria-label={L.roundNext} disabled={round >= lastRound} onclick={() => pickRound(round + 1)}>›</button>
      </div>
      <div class="lg-links">
        <button class="lg-link" type="button" data-act="league-fixtures-open" aria-haspopup="dialog" onclick={() => (fixtures = true)}>{L.fixtureOpen}</button>
        {#if round !== thisRound}<button class="lg-link" type="button" data-act="league-round-now" onclick={() => pickRound(thisRound)}>{L.goThisRound}</button>{/if}
      </div>
      {#if day}
        {#each slots as slot (slot.at)}
          <div class="lg-slot" data-league-slot={slot.time}>
            <h3>{slot.time}</h3>
            <ul class="lg-matches">
              {#each slot.matches as m (m.id)}
                <li class:mine={m.homeTeamId === mineId || m.awayTeamId === mineId} data-league-match={m.id}>
                  <span class="lg-side">{name(m.homeTeamId)}</span>
                  {#if m.played && !m.forfeit}
                    <button class="lg-mid lg-open" data-act="league-match-open" onclick={() => onopen(m, table!)}>{leagueSlotMid(m)}</button>
                  {:else}
                    <span class="lg-mid">{leagueSlotMid(m)}{#if m.forfeit}<small class="pill warn">{L.forfeitScore}</small>{/if}</span>
                  {/if}
                  <span class="lg-side away">{name(m.awayTeamId)}</span>
                </li>
              {/each}
            </ul>
          </div>
        {/each}
        {#each day.resting as t (t.teamId)}<p class="muted fs-sm" data-league-rest>{L.restTeam({ team: t.name })}</p>{/each}
      {/if}
      {#if round === lastRound && finalReady}
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
    {#if fixtures}
      <PopSheet label={L.fixtureTitle} onclose={() => (fixtures = false)}>
        <div class="lg-fx">
          <h2>{L.fixtureTitle}</h2>
          <ol>
            {#each fixtureRows as f (f.round)}
              {#snippet row()}
                <button class="lg-fx-row" class:on={f.round === round} class:now={f.state === 'now'} class:done={f.state === 'done'} type="button" data-league-fixture={f.round} onclick={() => openFixture(f)}>
                  <span class="lg-fx-when"><b>{L.roundName({ n: f.round })}</b><small class="muted">{f.day}</small></span>
                  {#if f.mine && !f.mine.rest}
                    <span class="lg-fx-vs"><span>{f.mine.opponent}</span><small class="muted">{f.mine.side}</small></span>
                    <b class="lg-fx-mid" class:w={f.mine.result === 'w'} class:l={f.mine.result === 'l'}>{f.mine.mid}</b>
                  {:else if f.mine}
                    <small class="muted lg-fx-state">{L.fixtureRest}</small>
                  {:else}
                    <small class="muted lg-fx-state">{f.state === 'now' ? L.fixtureNow : f.state === 'done' ? L.fixtureDone : L.fixtureLater}</small>
                  {/if}
                </button>
              {/snippet}
              {#if f.state === 'now'}<li use:showNow>{@render row()}</li>{:else}<li>{@render row()}</li>{/if}
            {/each}
          </ol>
          <button class="btn lg-fx-close" type="button" data-act="league-fixtures-close" onclick={() => (fixtures = false)}>{L.sheetClose}</button>
        </div>
      </PopSheet>
    {/if}
    {#if live}<LeagueFinalLive {table} {mineId} onclose={() => (live = false)} />{/if}
  {/if}
</LoadState>

<style>
  .lg-sec { display: flex; flex-direction: column; gap: 10px; }
  .lg-sec h2 { margin: 0; }
  .lg-links { display: flex; justify-content: center; gap: 16px; margin-top: -6px; }
  .lg-link { min-height: 44px; padding: 0 2px; border: 0; background: transparent; color: var(--accent-text); font: inherit; font-size: var(--fs-body2); font-weight: 600; cursor: pointer; }
  .lg-step { display: grid; grid-template-columns: 44px minmax(0, 1fr) 44px; gap: 4px; }
  .lg-arrow { min-height: 52px; border: 0; border-radius: var(--radius-sm, 8px); background: transparent; color: inherit; font-size: 24px; line-height: 1; cursor: pointer; }
  .lg-arrow:disabled { opacity: 0.3; cursor: default; }
  .lg-now { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; min-width: 0; text-align: center; }
  .lg-now small { font-size: var(--fs-caption); }
  .lg-slot h3 { margin: 0 0 2px; color: var(--muted); font-family: var(--display); font-size: var(--fs-label); font-weight: 700; font-variant-numeric: tabular-nums; }
  .lg-my { display: flex; align-items: center; gap: 10px; min-height: 48px; border-top: 1px solid var(--line); padding-top: 8px; font-size: var(--fs-body2); }
  .lg-my-who { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; overflow-wrap: anywhere; }
  .lg-my-who small { font-size: 11px; }
  .lg-my-when { flex: none; font-size: var(--fs-caption); }
  .lg-my-watch { flex: none; min-height: 44px; }
  .lg-fx { display: flex; flex-direction: column; gap: 12px; }
  .lg-fx h2 { margin: 0; }
  .lg-fx ol { list-style: none; margin: 0; padding: 0; }
  .lg-fx li + li { border-top: 1px solid var(--line); }
  .lg-fx-row { display: grid; grid-template-columns: minmax(96px, auto) minmax(0, 1fr) auto; align-items: center; gap: 10px; width: 100%; min-height: 56px; padding: 6px 8px; border: 0; background: transparent; color: inherit; font: inherit; font-size: var(--fs-body2); text-align: left; cursor: pointer; }
  .lg-fx-row.now { background: color-mix(in srgb, var(--accent) 12%, transparent); box-shadow: inset 3px 0 0 var(--accent); }
  .lg-fx-row.on b:first-child { color: var(--accent-text); }
  .lg-fx-when, .lg-fx-vs { display: flex; flex-direction: column; gap: 2px; min-width: 0; overflow-wrap: anywhere; }
  .lg-fx-when small, .lg-fx-vs small, .lg-fx-state { font-size: 11px; }
  .lg-fx-state { grid-column: 2 / -1; text-align: right; }
  .lg-fx-mid { font-family: var(--display); font-variant-numeric: tabular-nums; }
  .lg-fx-mid.w { color: var(--good); }
  .lg-fx-mid.l { color: var(--warn); }
  .lg-fx-close { min-height: 44px; }
  .lg-scroll { overflow-x: auto; }
  .lg-table { width: 100%; border-collapse: collapse; font-size: var(--fs-label); font-variant-numeric: tabular-nums; }
  .lg-table th, .lg-table td { padding: 8px 2px; text-align: center; white-space: nowrap; }
  .lg-table th { font-weight: 600; color: var(--muted); font-size: var(--fs-caption); }
  .lg-table .t { width: 100%; text-align: left; white-space: normal; }
  .lg-table tbody tr { border-top: 1px solid var(--line); }
  .lg-table tr.up { background: color-mix(in srgb, var(--good) 12%, transparent); box-shadow: inset 3px 0 0 var(--good); }
  .lg-table tr.down { background: color-mix(in srgb, var(--warn) 10%, transparent); box-shadow: inset 3px 0 0 var(--warn); }
  .lg-table tr.mine b { color: var(--accent-text); }
  .lg-who { display: flex; align-items: center; gap: 6px; width: 100%; min-height: 44px; padding: 0; border: 0; border-radius: var(--radius-xs); background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
  .lg-who:disabled { cursor: default; }
  .lg-who:not(:disabled):hover b { text-decoration: underline; }
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
