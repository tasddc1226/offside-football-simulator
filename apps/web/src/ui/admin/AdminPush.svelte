<script lang="ts">
  import AdminCupPush from './AdminCupPush.svelte';
  import { onMount } from 'svelte';
  import type { PushPerformance, PushMetrics, PushCategory } from '@offside/contracts';
  import { fetchPushPerformance } from '@offside/app-core/api/admin';
  import { kstDateTime as kst } from '@offside/app-core/boardText';
  import { PUSH_CATEGORY_LABELS as labels, PUSH_METRIC_LABELS, pushClickRate, pushStatus, pushAdminText as L, retentionText as R, RETENTION_METRICS } from '@offside/app-core/pushPerformance';

  let selectedPeriod = $state('7');
  let category = $state<PushCategory | ''>('');
  let issues = $state(false);
  let tests = $state(false);
  let data = $state<PushPerformance | null>(null);
  let busy = $state(false);
  let error = $state('');
  let page = $state(0);
  let revision = 0;
  const periods = () => [['1', L.today], ['yesterday', L.yesterday], ['7', L.week], ['30', L.month], ['90', L.quarter]] as const;
  onMount(() => { void load(); return () => { revision++; }; });
  async function load(fresh = false, more = false) {
    const rev = ++revision;
    busy = true; error = '';
    const next = more ? page + 1 : 0;
    const result = await fetchPushPerformance(selectedPeriod === 'yesterday' ? 1 : Number(selectedPeriod), tests, next, fresh, more ? data?.cohortThrough : undefined, { previous: selectedPeriod === 'yesterday', category: category || undefined, issues });
    if (rev !== revision) return;
    busy = false;
    if (!result.ok) { error = result.error.message; return; }
    data = more && data ? { ...result.data, campaigns: [...data.campaigns, ...result.data.campaigns], cups: [...(data.cups ?? []), ...(result.data.cups ?? [])] } : result.data;
    page = next;
  }
  function filter() { data = null; void load(); }
</script>

{#snippet resultRow(m: PushMetrics, title: string, subtitle: string)}
  <details class="push-row">
    <summary>
      <span class="push-title"><strong>{title}</strong>{#if subtitle}<small class="muted">{subtitle}</small>{/if}</span>
      <span class="push-rate">{L.deviceAccepted}<b>{m.accepted.toLocaleString()}</b></span>
      {#if pushStatus(m)}<span class="push-line" class:error={m.failed + m.unknown > 0}>{pushStatus(m)}</span>{/if}
    </summary>
    <dl class="push-details">
      {#each PUSH_METRIC_LABELS as metric (metric.key)}<div><dt>{metric.label}</dt><dd>{m[metric.key].toLocaleString()}</dd></div>{/each}
      {#each ['waiting','sending','checking'] as const as key (key)}{#if m[key] !== undefined}<div><dt>{L[key]}</dt><dd>{m[key].toLocaleString()}</dd></div>{/if}{/each}
      <div><dt>{L.acceptedNotifications}</dt><dd>{m.acceptedRecipients.toLocaleString()}</dd></div>
      <div><dt>{L.clicked}</dt><dd>{m.clicked.toLocaleString()}</dd></div>
      <div><dt>{L.clickRate}</dt><dd>{pushClickRate(m)}</dd></div>
      <div><dt>{L.targetOpened}</dt><dd>{m.targetOpened.toLocaleString()}</dd></div>
    </dl>
    {#if m.failed + m.unknown + m.cancelled > 0}<p class="muted fs-xs row-help">{L.failureHelp}</p>{/if}
  </details>
{/snippet}

<div class="stack push-panel" style="gap:14px" data-admin="push">
  <div class="row" style="justify-content:space-between;flex-wrap:wrap">
    <h2 style="margin:0">{L.title}</h2>
    <button class="icon-btn" disabled={busy} onclick={() => load(true)}>{busy ? L.loading : L.refresh}</button>
  </div>
  <div class="seg push-periods" role="group" aria-label={L.period}>
    {#each periods() as [value, label] (value)}<button class="opt" aria-pressed={selectedPeriod === value} disabled={busy} onclick={() => { selectedPeriod = value; filter(); }}>{label}</button>{/each}
  </div>
  <div class="push-filters">
    <label>{L.category}<select bind:value={category} disabled={busy} onchange={filter}><option value="">{L.all}</option>{#each Object.entries(labels) as [value, label] (value)}<option value={value}>{label}</option>{/each}</select></label>
    <label class="push-check"><input type="checkbox" bind:checked={tests} disabled={busy} onchange={filter} />{L.tests}</label>
  </div>
  {#if error}<p class="error" role="alert">{error}</p><button class="icon-btn self-start" disabled={busy} onclick={() => load(true)}>{L.retry}</button>{/if}
  {#if busy && !data}<p class="muted" aria-live="polite">{L.loading}</p>{/if}
  {#if data}
    <p class="muted fs-xs">{kst(data.generatedAt)} {L.asOf}<br />{L.range}: {kst(data.from)} – {kst(data.cohortThrough)}</p>
    <section aria-label={L.summary} class="stack" style="gap:8px">
      <h3>{L.summary}</h3>
      <div class="push-summary">
        <div><span>{L.deviceAccepted}</span><b>{data.totals.accepted.toLocaleString()}</b><small class="muted">{L.providerConfirmed} {data.totals.confirmed.toLocaleString()}</small></div>
        <div><span>{L.failed} / {L.unknown}</span><b class:error={data.totals.failed + data.totals.unknown > 0}>{data.totals.failed.toLocaleString()} / {data.totals.unknown.toLocaleString()}</b><small class="muted">{L.cancelled} {data.totals.cancelled.toLocaleString()}</small></div>
      </div>
      <p class="push-states">{pushStatus({ ...data.totals, failed: 0, unknown: 0, cancelled: 0 }) || `${L.pending} 0`}</p>
      <details class="push-help"><summary>{L.help}</summary><div class="stack" style="gap:8px"><p>{L.queueHelp}</p><p>{L.receiptHelp}</p><p>{L.metricsHelp}</p><p>{L.failureHelp}</p></div></details>
    </section>
    <section class="stack" style="gap:8px" aria-label={L.recent}>
      <h3>{L.recent}</h3>
      <label class="push-check"><input type="checkbox" bind:checked={issues} disabled={busy} onchange={filter} />{L.issues}</label>
      {#if issues}<p class="muted fs-xs">{L.issuesHelp}</p>{/if}
      <p class="muted fs-xs">{L.recentHelp}</p>
      {#each data.campaigns as m (m.id)}{@render resultRow(m, m.title, `${labels[m.category]} · ${kst(m.createdAt)}`)}{:else}<p class="muted">{L.empty}</p>{/each}
      {#if data.hasMore}<button class="icon-btn" disabled={busy} onclick={() => load(false, true)}>{L.more}</button>{/if}
    </section>
    <details class="push-analysis"><summary>{L.analysis}</summary><div class="stack" style="gap:16px">
      <div class="push-summary"><div><span>{L.clickRate}</span><b>{pushClickRate(data.totals)}</b><small>{L.clicked} {data.totals.clicked.toLocaleString()} / {L.acceptedNotifications} {data.totals.acceptedRecipients.toLocaleString()}</small></div><div><span>{L.targetOpened}</span><b>{data.totals.targetOpened.toLocaleString()}</b></div></div>
    <AdminCupPush items={data.cups} />
    <section class="stack retention" style="gap:10px" aria-label={R.title}>
      <h3>{R.title}</h3>
      <p class="muted fs-xs">{R.policy}</p>
      {#each data.retention ?? [] as item (item.stage)}
        <details class="push-row">
          <summary><strong>{R[item.stage === 1 ? 'stage1' : item.stage === 2 ? 'stage2' : 'stage3']}</strong></summary>
          <dl class="push-details">
            {#each RETENTION_METRICS as key (key)}<div><dt>{R[key]}</dt><dd>{item[key].toLocaleString()}</dd></div>{/each}
          </dl>
        </details>
      {:else}<p class="muted">{R.empty}</p>{/each}
      <p class="muted fs-xs">{R.help}</p>
    </section>

      <section class="stack" style="gap:8px" aria-label={L.categories}>
        <h3>{L.categories}</h3>
        {#each data.categories as m (m.category)}{@render resultRow(m, labels[m.category], '')}{:else}<p class="muted">{L.empty}</p>{/each}
      </section>
      {#if data.daily.length}<details class="push-help"><summary>{L.daily}</summary>
        {#each data.daily as day (day.day)}<div class="push-day"><strong>{day.day}</strong><span>{L.deviceAccepted} {day.accepted} · {L.clicked} {day.clicked} · {L.targetOpened} {day.targetOpened}</span></div>{/each}
      </details>{/if}
      <p class="muted fs-xs">{L.targetHelp}</p><p class="muted fs-xs">{L.trackingHelp} {L.trackingStart}: {kst(data.trackingStartedAt)}</p>
    </div></details>
  {/if}
</div>
<style>
  .retention { border-block: 1px solid var(--line); padding-block: 16px; }
  .retention summary { display: block; }
  .retention p { line-height: 1.6; }
  .push-periods { grid-template-columns: repeat(5,minmax(0,1fr)); }
  .push-periods button { padding-inline: 2px; min-height: 44px; }
  .push-filters { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; }
  .push-filters > label:first-child { flex: 1 1 180px; display: flex; flex-direction: column; gap: 4px; }
  select { width: 100%; min-width: 0; min-height: 44px; color: var(--ink); background: var(--bg); border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 8px; }
  .push-check { display: flex; align-items: center; gap: 8px; min-height: 44px; cursor: pointer; }
  .push-check input { flex: 0 0 auto; width: 20px; height: 20px; }
  .push-states { font-variant-numeric: tabular-nums; line-height: 1.6; }
  .push-analysis { border-top: 2px solid var(--line); }
  .push-analysis > summary { font-weight: 700; }
  .row-help { padding-bottom: 12px; }
  .push-panel { min-width: 0; }
  .push-panel h3, .push-panel p { margin: 0; }
  .push-summary { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 10px; }
  .push-summary > div { display: flex; flex-direction: column; gap: 4px; padding: 12px; border: 1px solid var(--line); border-radius: var(--radius-md); overflow-wrap: anywhere; }
  .push-summary b { font-size: var(--fs-title2); font-variant-numeric: tabular-nums; }
  .push-row { border-top: 1px solid var(--line); }
  summary { cursor: pointer; min-height: 44px; padding: 12px 0; }
  summary:focus-visible { outline: 2px solid var(--ink); outline-offset: 3px; }
  .push-row summary { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 8px; }
  .push-title { display: flex; flex-direction: column; gap: 4px; overflow-wrap: anywhere; }
  .push-rate { text-align: right; font-size: var(--fs-body2); }
  .push-rate b { display: block; font-size: var(--fs-title3); font-variant-numeric: tabular-nums; }
  .push-line { grid-column: 1 / -1; font-size: var(--fs-body2); }
  .push-details { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 8px; margin: 0 0 12px; }
  .push-details > div, .push-day { display: flex; flex-wrap: wrap; gap: 4px 10px; justify-content: space-between; font-size: var(--fs-body2); }
  .push-details dd { margin: 0; font-variant-numeric: tabular-nums; }
  .push-help { border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 0 12px; font-size: var(--fs-body2); }
  .push-help > div { padding-bottom: 12px; }
  .push-day { padding: 8px 0; border-top: 1px solid var(--line); }
  @media (max-width:360px) { .push-details { grid-template-columns: 1fr; } }
</style>
