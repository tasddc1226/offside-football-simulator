<script lang="ts">
  import { onMount } from 'svelte';
  import * as api from '@offside/app-core/api/admin';
  import type { AutomationEnforcement } from '@offside/contracts';
  import { automationModerationText as L } from '@offside/app-core/i18n/ko/automationModeration';
  import { kstDateTime as kst } from '@offside/app-core/boardText';
  import LoadState, { type LoadStatus } from '../LoadState.svelte';
  let report = $state<AutomationEnforcement | null>(null);
  let status = $state<LoadStatus>('loading');
  let busy = $state(false);
  let error = $state('');
  async function load(before?: string, fresh = false) {
    if (busy) return;
    busy = true;
    const r = await api.fetchAutomationEnforcement(before, fresh);
    busy = false;
    if (!r.ok) { if (!before) status = 'error'; else error = L.fail; return; }
    report = before && report ? { ...r.data, actions: [...report.actions, ...r.data.actions] } : r.data;
    status = 'ready'; error = '';
  }
  async function restore(id: string) {
    if (busy || !confirm(L.confirm)) return;
    busy = true;
    const r = await api.setAutomationHidden(id, false);
    busy = false;
    if (!r.ok) { error = L.restoreFail; return; }
    await load(undefined, true);
  }
  onMount(() => void load());
</script>
<section class="stack moderation" style="gap:10px" data-automation-enforcement>
  <div class="row heading">
    <h2 style="margin:0">{L.title}</h2>
    <button class="icon-btn" disabled={busy} onclick={() => load(undefined, true)}>{L.refresh}</button>
  </div>
  <p class="muted fs-sm">{L.policy}</p>
  <p class="muted fs-xs">{L.preserve}</p>
  <LoadState {status} failText={L.fail} retry={() => load(undefined, true)}>
    {#if report}
      <b class="fs-sm">{report.enabled ? L.enabled : L.paused} · {L.version} {report.ruleVersion}</b>
      {#if report.sweep}
        {@const s = report.sweep}
        <p class="fs-sm" data-automation-sweep>{s.status === 'complete' ? L.complete : s.status === 'error' ? L.error : L.running}<br />
          {kst(s.updatedAt)} · {L.checked} {s.checked.toLocaleString()} · {L.hiddenCount} {s.hidden.toLocaleString()}
        </p>
        {#if s.error}<p class="fs-xs diagnostic" role="alert">{L.failureReason}: {s.error}</p>{/if}
      {:else}<p class="muted fs-sm">{L.notRun}</p>{/if}
      <h3 class="fs-sm" style="margin:0">{L.history}</h3>
      {#each report.actions as a (a.key)}
        <article class="action" data-automation-action={a.careerId}>
          <div class="row heading"><b>{a.action === 'hide' ? L.hideAction : L.restoreAction}</b><span class="pill">{a.hidden ? L.hidden : L.restored}</span></div>
          <code>{a.careerId}</code>
          <span class="muted fs-xs">{kst(a.at)} · {L[a.source]} · {L.version} {a.ruleVersion}</span>
          <span class="fs-sm">{a.reasons.map(r => r in L ? L[r as 'webdriver' | 'headless' | 'synthetic' | 'noInput'] : r).join(' · ')}{a.seasons ? ` · ${L.seasons} ${a.seasons}` : ''}</span>
          {#if a.hidden}<button class="btn sm" disabled={busy} onclick={() => restore(a.careerId)}>{L.restore}</button>{/if}
        </article>
      {:else}<p class="muted fs-sm">{L.empty}</p>{/each}
      {#if report.next}<button class="btn" disabled={busy} onclick={() => load(report?.next ?? undefined)}>{L.more}</button>{/if}
    {/if}
  </LoadState>
  {#if error}<p class="bad fs-sm" role="alert">{error}</p>{/if}
</section>
<style>
  .moderation { border-bottom:1px solid var(--line);padding-bottom:16px;min-width:0; }
  .moderation p {margin:0;}
  .heading {justify-content:space-between;gap:8px;flex-wrap:wrap;}
  .action {border:1px solid var(--line);border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:8px;min-width:0;}
  .diagnostic { overflow-wrap:anywhere; }
  code {overflow-wrap:anywhere;font-size:0.75rem;}
  button {min-height:44px;}
</style>
