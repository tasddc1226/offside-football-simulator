<script lang="ts">
  import { onMount } from 'svelte';
  import { PlayerManagement } from '@offside/app-core/playerManagement';
  import { releaseLock, releaseAmount, releaseValue, releaseConfirmText, fundsText } from '@offside/app-core/market';
  import { localCareerNames } from '@offside/game/hof-store';
  import { playerName } from '@offside/app-core/format';
  import { marketText as M } from '@offside/app-core/i18n/ko/market';
  import { ownerPlayersText as L } from '@offside/app-core/i18n/ko/ownerPlayers';
  import { openPublicLegendById } from '../legend.js';
  const { season }: { season: number } = $props();
  const manager = new PlayerManagement();
  let state = $state(manager.state);
  const local = localCareerNames();
  const selected = $derived(state.players.filter(p => state.selected.has(p.careerId) && !releaseLock(p, state.lineup)));
  const amount = $derived(releaseAmount(selected, state.rate));
  const nameOf = (p: typeof state.players[number]) => local.get(p.careerId) ?? playerName(p.publicName, p.pos, p.number);
  onMount(() => { const unsubscribe = manager.subscribe(s => state = s); return () => { unsubscribe(); manager.dispose(); }; });
  $effect(() => { void manager.load(season); });
</script>

<div class="stack pm" data-player-management aria-busy={state.busy || state.loading}>
  <p class="muted fs-sm">{M.releaseIntro}</p>
  {#if state.notice}<p role="status" class="good">{state.notice}</p>{/if}
  {#if state.error}<p role="alert">{state.error}</p><button class="btn" disabled={state.busy} onclick={() => manager.load(season)}>{L.retry}</button>{/if}
  {#if state.loading}<p role="status">{L.loading}</p>{:else}
    <button class="btn" data-act="players-pick-all" disabled={state.busy || state.confirm || !manager.eligible.length} onclick={() => manager.selectAll()}>{state.selected.size ? M.pickNone : L.pickLimit}</button>
    {#each state.players as p (p.careerId)}
      {@const locked = releaseLock(p, state.lineup)}
      <div class="pm-row" data-managed-player={p.careerId}>
        <label class="pm-pick">
          <input type="checkbox" checked={state.selected.has(p.careerId)} disabled={!!locked || state.busy || state.confirm} aria-label={M.releasePickLabel({ name: nameOf(p) })} onchange={() => manager.toggle(p.careerId)} />
          <span class="stack" style="gap:4px;min-width:0"><b>{nameOf(p)}</b><small class="muted">{locked ?? M.releaseInfo({score: String(p.legendScore ?? 0)})}</small>{#if !locked}<small>{fundsText(releaseValue(p, state.rate))}</small>{/if}</span>
        </label>
        <button class="btn btn-sm" disabled={state.busy} data-player-detail={p.careerId} onclick={() => openPublicLegendById(p.careerId)}>{L.viewRecord}</button>
      </div>
    {:else}<p class="empty">{L.noOwned}</p>{/each}
    {#if selected.length}
      <section class="card stack pm-confirm" data-player-release-summary>
        <b>{M.dockSum({n:selected.length})} · {fundsText(amount)}</b>
        {#if state.confirm}
          <p>{releaseConfirmText(selected.length, amount)}</p>
          <div class="pm-actions"><button class="btn" disabled={state.busy} onclick={() => manager.confirm(false)}>{M.close}</button><button class="btn pm-danger" data-act="players-release-confirm" disabled={state.busy} onclick={() => manager.release()}>{M.releaseBtn({n:selected.length})}</button></div>
        {:else}<p class="muted fs-sm">{M.dockWarn}</p><button class="btn pm-danger" data-act="players-release" disabled={state.busy} onclick={() => manager.confirm(true)}>{M.releaseBtn({n:selected.length})}</button>{/if}
      </section>
    {/if}
  {/if}
</div>
<style>
  .pm {gap:12px;}
  .pm-row {display:flex;flex-wrap:wrap;align-items:center;gap:8px;border-top:1px solid var(--line);padding:12px 0;}
  .pm-pick {display:flex;align-items:center;gap:10px;flex:1 1 180px;min-height:44px;cursor:pointer;}
  .pm-pick b {overflow-wrap:anywhere;}
  .pm-pick input {width:22px;height:22px;flex:none;accent-color:var(--good);}
  .pm-row button {min-height:44px;}
  .pm-confirm {background:var(--surface-2);}
  .pm-actions {display:flex;gap:8px;flex-wrap:wrap;}
  .pm-actions button {flex:1;min-height:44px;}
  .pm-danger {color:var(--bad);border-color:var(--bad);}
</style>
