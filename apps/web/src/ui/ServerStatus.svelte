<script lang="ts">
  import Skeleton from './Skeleton.svelte';
  // T-11-321 설정의 '서버 상태'(앱 screens/settings/ServerStatus.tsx). 값은 app-core serverStatusView, 펼칠 때만 불러온다.
  import { loadServerStatus, type ServerStatusView } from '@offside/app-core/serverStatus';
  import { serverStatusText as L } from '@offside/app-core/i18n/ko/serverStatus';

  let view = $state<ServerStatusView | 'error' | null>(null);
  function load(e: Event) {
    if (!(e.currentTarget as HTMLDetailsElement).open) return;
    if (view !== null && view !== 'error') return;
    view = null;
    void loadServerStatus().then((r) => (view = r));
  }
</script>

<details class="card settings-card server-status" data-settings="server-status" ontoggle={load}>
  <summary><b>{L.title}</b></summary>
  <p class="muted fs-sm">{L.intro}</p>
  {#if view === null}
    <Skeleton rows={2} />
  {:else if view === 'error'}
    <p class="muted fs-sm">{L.error}</p>
  {:else}
    <p class="status-head" data-status-level={view.level}><span class="dot" aria-hidden="true"></span>{view.headline}</p>
    {#if view.trend}<p class="fs-sm" data-status-trend>{view.trend}</p>{/if}

    {#if view.recent.length}
      <h3 class="status-h">{L.recentTitle}</h3>
      <dl class="status-recent">
        {#each view.recent as [term, value] (term)}
          <div><dt class="muted fs-xs">{term}</dt><dd class="num">{value}</dd></div>
        {/each}
      </dl>
    {/if}

    <h3 class="status-h">{L.hoursTitle}</h3>
    {#each [[L.hoursRequests, 'reqBar', 'requests'], [L.hoursAvg, 'avgBar', 'avgMs']] as const as [label, bar, value] (label)}
      <p class="muted fs-xs status-chart-label">{label}</p>
      <div class="status-bars" data-status-chart={value}>
        {#each view.hours as h, i (i)}
          <span
            class="bar"
            class:avg={bar === 'avgBar'}
            style:height={`${Math.max(2, h[bar] * 100)}%`}
            title={`${h.label}:00 · ${h[value].toLocaleString('en-US')}${value === 'avgMs' ? 'ms' : ''}`}
          ></span>
        {/each}
      </div>
      <div class="status-axis muted fs-xs" aria-hidden="true">
        <span>{view.hours[0]?.label}</span><span>{view.hours[12]?.label}</span><span>{view.hours[23]?.label}</span>
      </div>
    {/each}

    {#if view.days.length}
      <h3 class="status-h">{L.daysTitle}</h3>
      <div class="status-table">
        <table data-status-days>
          <thead><tr><th>{L.colDay}</th><th class="n">{L.colRequests}</th><th class="n">{L.colAvg}</th><th class="n">{L.colSlow}</th></tr></thead>
          <tbody>
            {#each view.days as d (d.day)}
              <tr><td>{d.day}</td><td class="n">{d.requests}</td><td class="n">{d.avg}</td><td class="n">{d.slow}</td></tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
    <p class="muted fs-xs">{L.note}</p>
  {/if}
</details>

<style>
  .server-status summary {
    cursor: pointer;
  }
  .status-head {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 700;
    margin: 12px 0 4px;
  }
  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--muted);
  }
  [data-status-level='ok'] .dot {
    background: #2e9d5b;
  }
  [data-status-level='slow'] .dot {
    background: var(--accent);
  }
  [data-status-level='down'] .dot {
    background: #d64545;
  }
  .status-h {
    font-size: 0.875rem;
    margin: 16px 0 6px;
  }
  .status-recent {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 8px;
    margin: 0;
  }
  .status-recent dd {
    margin: 2px 0 0;
    font-weight: 700;
  }
  .status-chart-label {
    margin: 8px 0 4px;
  }
  .status-bars {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    height: 64px;
    border-bottom: 1px solid var(--line);
  }
  .bar {
    flex: 1;
    background: var(--accent);
    border-radius: 2px 2px 0 0;
    min-width: 0;
  }
  .bar.avg {
    background: var(--muted);
  }
  .status-axis {
    display: flex;
    justify-content: space-between;
  }
  .status-table {
    overflow-x: auto;
  }
  .status-table table {
    width: 100%;
  }
  .n {
    text-align: right;
  }
</style>
