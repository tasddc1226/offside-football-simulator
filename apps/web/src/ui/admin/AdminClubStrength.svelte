<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchStrengthHistory, type StrengthHistory } from '@offside/app-core/api/club-strength';
  import { T, leagueName, clubName, strengthReason } from '@offside/app-core/admin/club-strength';
  import { kstDateTime } from '@offside/app-core/boardText';
  import LoadState, { type LoadStatus } from '../LoadState.svelte';
  let report = $state<StrengthHistory | null>(null);
  let status = $state<LoadStatus>('loading');
  let busy = $state(false);
  async function load(before?: string, fresh = false) {
    if (busy) return;
    busy = true;
    const r = await fetchStrengthHistory(before, fresh);
    if (!r.ok) { status = 'error'; busy = false; return; }
    report = before && report ? { ...r.data, runs: [...report.runs, ...r.data.runs] } : r.data;
    status = 'ready'; busy = false;
  }
  onMount(() => { void load(); });
</script>
<div class="stack" data-admin="club-strength">
  <div class="row header">
    <h2>{T.title}</h2>
    <button class="btn" disabled={busy} onclick={() => load(undefined, true)}>{T.refresh}</button>
  </div>
  <p class="muted">{T.note}</p>
  <LoadState {status} failText={T.fail} retry={() => load(undefined, true)}>
    {#if report}
      <p>{T.version}: <strong>v{report.current.v}</strong><br /><span class="muted">{T.asOf}: {report.current.asOf}</span></p>
      {#each report.runs as run (run.day)}
        <section class="run stack">
          <h3>{kstDateTime(run.at)} · v{run.version}</h3>
          {#each run.leagues as league (league.league)}
            <details>
              <summary><strong>{leagueName(league.league)}</strong><span>{T[league.status]}</span></summary>
              <p class="muted">{strengthReason(league.reason)}</p>
              {#if league.season}<p>{T.season}: {league.season}</p>{/if}
              {#if league.status === 'failed'}<p class="muted code">{league.reason}</p>{/if}
              <ul aria-label={T.rows}>
                {#each league.changes as row (row.id)}
                  <li><span>{clubName(row.id)}</span><b>{row.before} → {row.after} ({row.after-row.before>0 ? '+' : ''}{row.after-row.before})</b></li>
                {/each}
              </ul>
            </details>
          {/each}
        </section>
      {:else}<p class="muted">{T.empty}</p>{/each}
      {#if report.nextBefore}<button class="btn" disabled={busy} onclick={() => load(report!.nextBefore!)}>{T.more}</button>{/if}
    {/if}
  </LoadState>
</div>
<style>
  h2,h3,p { margin:0; }
  .header { justify-content:space-between; flex-wrap:wrap; gap:8px; }
  .run { border-top:1px solid var(--line); padding-top:14px; }
  summary { display:flex; justify-content:space-between; align-items:center; gap:8px; min-height:44px; cursor:pointer; }
  details { border-bottom:1px solid var(--line); }
  details p { margin:8px 0; }
  ul { list-style:none; padding:0; margin:8px 0; }
  li { display:flex; justify-content:space-between; flex-wrap:wrap; gap:8px; padding:8px 0; }
  li b { white-space:nowrap; font-variant-numeric:tabular-nums; }
  .code { overflow-wrap:anywhere; }
</style>
