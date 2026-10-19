<script lang="ts">
  import Skeleton from '../Skeleton.svelte';
  import { onMount } from 'svelte';
  import { PlayerManagement } from '@offside/app-core/playerManagement';
  import { releaseLock, releaseAmount, releaseValue, releaseConfirmText, fundsText } from '@offside/app-core/market';
  import { localCareerNames } from '@offside/game/hof-store';
  import { playerName } from '@offside/app-core/format';
  import { marketText as M } from '@offside/app-core/i18n/ko/market';
  import { ownerPlayersText as L } from '@offside/app-core/i18n/ko/ownerPlayers';
  import { openPublicLegendById } from '../legend.js';
  import { renameText as RN } from '@offside/app-core/i18n/ko/rename';
  const { season }: { season: number } = $props();
  const manager = new PlayerManagement();
  let pm = $state(manager.state);
  const local = localCareerNames();
  // T-11-377 이름 변경권으로 바꾼 이름(목록을 다시 받기 전까지 바로 보인다)과 열린 창의 선수.
  let renamed = $state<Record<string, string>>({});
  let renaming = $state<{ careerId: string; name: string } | null>(null);
  const selected = $derived(pm.players.filter(p => pm.selected.has(p.careerId) && !releaseLock(p, pm.lineup)));
  const amount = $derived(releaseAmount(selected, pm.rate));
  const nameOf = (p: typeof pm.players[number]) => renamed[p.careerId] ?? local.get(p.careerId) ?? playerName(p.publicName, p.pos, p.number);
  onMount(() => { const unsubscribe = manager.subscribe(s => pm = s); return () => { unsubscribe(); manager.dispose(); }; });
  $effect(() => { void manager.load(season); });
</script>

<div class="stack pm" data-player-management aria-busy={pm.busy || pm.loading}>
  <p class="muted fs-sm">{M.releaseIntro}</p>
  {#if pm.notice}<p role="status" class="good">{pm.notice}</p>{/if}
  {#if pm.error}<p role="alert">{pm.error}</p><button class="btn" disabled={pm.busy} onclick={() => manager.load(season)}>{L.retry}</button>{/if}
  {#if pm.loading}<Skeleton rows={5} />{:else}
    <button class="btn" data-act="players-pick-all" disabled={pm.busy || pm.confirm || !manager.eligible.length} onclick={() => manager.selectAll()}>{pm.selected.size ? M.pickNone : L.pickLimit}</button>
    {#each pm.players as p (p.careerId)}
      {@const locked = releaseLock(p, pm.lineup)}
      <div class="pm-row" data-managed-player={p.careerId}>
        <label class="pm-pick">
          <input type="checkbox" checked={pm.selected.has(p.careerId)} disabled={!!locked || pm.busy || pm.confirm} aria-label={M.releasePickLabel({ name: nameOf(p) })} onchange={() => manager.toggle(p.careerId)} />
          <span class="stack" style="gap:4px;min-width:0"><b>{nameOf(p)}</b><small class="muted">{locked ?? M.releaseInfo({score: String(p.legendScore ?? 0)})}</small>{#if !locked}<small>{fundsText(releaseValue(p, pm.rate))}</small>{/if}</span>
        </label>
        <button class="btn btn-sm" disabled={pm.busy} data-player-detail={p.careerId} onclick={() => openPublicLegendById(p.careerId)}>{L.viewRecord}</button>
        <button class="btn btn-sm" disabled={pm.busy} data-player-rename={p.careerId} aria-label={RN.entryLabel({ name: nameOf(p) })} onclick={() => (renaming = { careerId: p.careerId, name: nameOf(p) })}>{RN.entry}</button>
      </div>
    {:else}<p class="empty">{L.noOwned}</p>{/each}
    {#if selected.length}
      <section class="card stack pm-confirm" data-player-release-summary>
        <b>{M.dockSum({n:selected.length})} · {fundsText(amount)}</b>
        {#if pm.confirm}
          <p>{releaseConfirmText(selected.length, amount)}</p>
          <div class="pm-actions"><button class="btn" disabled={pm.busy} onclick={() => manager.confirm(false)}>{M.close}</button><button class="btn pm-danger" data-act="players-release-confirm" disabled={pm.busy} onclick={() => manager.release()}>{M.releaseBtn({n:selected.length})}</button></div>
        {:else}<p class="muted fs-sm">{M.dockWarn}</p><button class="btn pm-danger" data-act="players-release" disabled={pm.busy} onclick={() => manager.confirm(true)}>{M.releaseBtn({n:selected.length})}</button>{/if}
      </section>
    {/if}
  {/if}
</div>
{#if renaming}
  {@const r = renaming}
  {#await import('../RenameSheet.svelte') then { default: RenameSheet }}<RenameSheet careerId={r.careerId} name={r.name} onclose={() => (renaming = null)} ondone={(n) => (renamed = { ...renamed, [r.careerId]: n })} />{/await}
{/if}
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
