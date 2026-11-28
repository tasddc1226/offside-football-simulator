<script lang="ts">
  import Skeleton from '../Skeleton.svelte';
  import { onMount } from 'svelte';
  import { PlayerManagement, MANAGE_SORTS, MANAGE_SORT_LABEL, manageNations, manageRowInfo, manageView, type ManageSort } from '@offside/app-core/playerManagement';
  import { releaseLock, releaseAmount, releaseValue, releaseConfirmText, fundsText, nationName, MARKET_POS_FILTERS } from '@offside/app-core/market';
  import { POS_LABEL } from '@offside/game/pos-label';
  import { tn } from '@offside/game/i18n/names';
  import { enhanceLossNote } from '@offside/app-core/cardEnhance';
  import { localCareerNames } from '@offside/game/hof-store';
  import { playerName } from '@offside/app-core/format';
  import { marketText as M } from '@offside/app-core/i18n/ko/market';
  import { ownerPlayersText as L } from '@offside/app-core/i18n/ko/ownerPlayers';
  import { openPublicLegendById } from '../legend.js';
  import { renameText as RN } from '@offside/app-core/i18n/ko/rename';
  const { season }: { season: number } = $props();
  import { fetchPhysiqueItems } from '@offside/app-core/api/cup';
  import { iapText as I } from '@offside/app-core/i18n/ko/iap';
  import {webPay,type PhysiqueDraft} from '../cup/webPay.svelte.js';
  let returning=$state<PhysiqueDraft|null>(null);
  $effect(()=>{
    const draft=webPay.physiqueDraft;
    if(!physiqueOn || !draft || pm.loading)return;
    const player=pm.players.find(p=>p.careerId===draft.card);
    if(!player)return;
    webPay.physiqueDraft=null;
    returning=draft;
    editing={id:player.careerId,name:nameOf(player)};
  });
  let physiqueOn=$state(false), editing=$state<{id:string;name:string}|null>(null);
  onMount(()=>{void fetchPhysiqueItems().then(r=>physiqueOn=r.ok && r.data.physique!==undefined);});
  const manager = new PlayerManagement();
  let pm = $state(manager.state);
  const local = localCareerNames();
  // T-11-377 이름 변경권으로 바꾼 이름(목록을 다시 받기 전까지 바로 보인다)과 열린 창의 선수.
  let renamed = $state<Record<string, string>>({});
  let renaming = $state<{ careerId: string; name: string } | null>(null);
  const selected = $derived(pm.players.filter(p => pm.selected.has(p.careerId) && !releaseLock(p, pm.lineup)));
  const amount = $derived(releaseAmount(selected, pm.rate));
  // T-11-841 포지션 · 국적 필터와 정렬(받은 목록 안에서만, 서버를 다시 부르지 않는다).
  const shown = $derived(manageView(pm.players, pm.filter, pm.sort));
  const nations = $derived(manageNations(pm.players));
  const filtered = $derived(!!(pm.filter.pos || pm.filter.nation));
  const nameOf = (p: typeof pm.players[number]) => renamed[p.careerId] ?? local.get(p.careerId) ?? playerName(p.publicName, p.pos, p.number);
  onMount(() => { const unsubscribe = manager.subscribe(s => pm = s); return () => { unsubscribe(); manager.dispose(); }; });
  $effect(() => { void manager.load(season); });
</script>

<div class="stack pm" data-player-management aria-busy={pm.busy || pm.loading}>
  <p class="muted fs-sm">{M.releaseIntro}</p>
  {#if pm.notice}<p role="status" class="good">{pm.notice}</p>{/if}
  {#if pm.error}<p role="alert">{pm.error}</p><button class="btn" disabled={pm.busy} onclick={() => manager.load(season)}>{L.retry}</button>{/if}
  {#if pm.loading}<Skeleton rows={5} />{:else}
    {#if pm.players.length}
      <div class="pm-filters" data-players-filters>
        <div class="pm-chips" role="group" aria-label={L.filterPos}>
          {#each MARKET_POS_FILTERS as pos (pos ?? 'all')}
            <button class="pm-chip" aria-pressed={pm.filter.pos === pos} data-players-pos={pos ?? 'all'} onclick={() => manager.setFilter({ pos })}>{pos ? tn(POS_LABEL[pos]) : M.posAll}</button>
          {/each}
        </div>
        <div class="pm-selects">
          <label class="fs-sm">{L.filterNation}
            <select value={pm.filter.nation ?? ''} data-players-nation onchange={(e) => manager.setFilter({ nation: e.currentTarget.value || undefined })}>
              <option value="">{L.nationAll}</option>
              {#each nations as n (n.code)}<option value={n.code}>{nationName(n.code)} ({n.n})</option>{/each}
            </select>
          </label>
          <label class="fs-sm">{L.sortLabel}
            <select value={pm.sort} data-players-sort onchange={(e) => manager.setSort(e.currentTarget.value as ManageSort)}>
              {#each MANAGE_SORTS as k (k)}<option value={k}>{MANAGE_SORT_LABEL[k]()}</option>{/each}
            </select>
          </label>
        </div>
        <div class="pm-count">
          <span class="muted fs-sm" data-players-count>{L.shownCount({ n: shown.length, total: pm.players.length })}</span>
          {#if filtered}<button class="pm-reset" data-players-reset onclick={() => manager.setFilter({ pos: undefined, nation: undefined })}>{L.filterReset}</button>{/if}
        </div>
      </div>
    {/if}
    <button class="btn" data-act="players-pick-all" disabled={pm.busy || pm.confirm || !manager.eligible.length} onclick={() => manager.selectAll()}>{pm.selected.size ? M.pickNone : L.pickLimit}</button>
    {#each shown as p (p.careerId)}
      {@const locked = releaseLock(p, pm.lineup)}
      <div class="pm-row" data-managed-player={p.careerId}>
        <label class="pm-pick">
          <input type="checkbox" checked={pm.selected.has(p.careerId)} disabled={!!locked || pm.busy || pm.confirm} aria-label={M.releasePickLabel({ name: nameOf(p) })} onchange={() => manager.toggle(p.careerId)} />
          <span class="stack" style="gap:4px;min-width:0"><b>{nameOf(p)}</b><small class="muted" data-release-info>{manageRowInfo(p)}</small>{#if locked}<small class="muted">{locked}</small>{:else}<small data-release-gets>{M.releaseGets({ amount: fundsText(releaseValue(p, pm.rate)) })}</small>{/if}</span>
        </label>
        <button class="btn btn-sm" disabled={pm.busy} data-player-detail={p.careerId} onclick={() => openPublicLegendById(p.careerId)}>{L.viewRecord}</button>
        {#if physiqueOn}<button class="btn btn-sm" disabled={pm.busy} onclick={()=>{returning=null;editing={id:p.careerId,name:nameOf(p)};}}>{I.physiqueTitle}</button>{/if}
        <button class="btn btn-sm" disabled={pm.busy} data-player-rename={p.careerId} aria-label={RN.entryLabel({ name: nameOf(p) })} onclick={() => (renaming = { careerId: p.careerId, name: nameOf(p) })}>{RN.entry}</button>
      </div>
    {:else}<p class="empty">{pm.players.length ? L.filterEmpty : L.noOwned}</p>{/each}
    {#if selected.length}
      <section class="card stack pm-confirm" data-player-release-summary>
        <b>{M.dockSum({n:selected.length})} · {fundsText(amount)}</b>
        {#if pm.confirm}
          <p>{releaseConfirmText(selected.length, amount)}</p>
          {#if enhanceLossNote(selected)}<p class="fs-sm" data-enhance-loss>{enhanceLossNote(selected)}</p>{/if}
          <div class="pm-actions"><button class="btn" disabled={pm.busy} onclick={() => manager.confirm(false)}>{M.close}</button><button class="btn pm-danger" data-act="players-release-confirm" disabled={pm.busy} onclick={() => manager.release()}>{M.releaseBtn({n:selected.length})}</button></div>
        {:else}<p class="muted fs-sm">{M.dockWarn}</p><button class="btn pm-danger" data-act="players-release" disabled={pm.busy} onclick={() => manager.confirm(true)}>{M.releaseBtn({n:selected.length})}</button>{/if}
      </section>
    {/if}
  {/if}
</div>
{#if editing}
  {@const e=editing}
  {#await import('./CardPhysique.svelte') then {default: Editor}}
    <Editor id={e.id} name={e.name} draft={returning} onclose={()=>editing=null} ondone={()=>{editing=null;void manager.load(season);}} />
  {/await}
{/if}
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
  .pm-filters {display:flex;flex-direction:column;gap:10px;}
  .pm-chips {display:flex;flex-wrap:wrap;gap:6px;}
  .pm-chip {min-height:36px;padding:0 14px;border-radius:var(--radius-pill);border:1px solid var(--line);background:var(--surface);color:var(--ink);font:inherit;font-size:var(--fs-label);cursor:pointer;}
  .pm-chip[aria-pressed='true'] {border-color:var(--ink);background:var(--ink);color:var(--surface);font-weight:600;}
  .pm-selects {display:flex;flex-wrap:wrap;gap:8px;}
  .pm-selects label {display:flex;align-items:center;gap:6px;flex:1 1 150px;color:var(--muted);}
  .pm-selects select {flex:1;min-width:0;min-height:40px;font:inherit;color:var(--ink);border:1px solid var(--line);border-radius:var(--radius-sm);background:var(--surface);padding:4px 6px;}
  .pm-count {display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:24px;}
  .pm-reset {border:0;padding:0;background:none;color:var(--accent-text);font:inherit;font-size:var(--fs-label);cursor:pointer;text-decoration:underline;}
  .pm-actions {display:flex;gap:8px;flex-wrap:wrap;}
  .pm-actions button {flex:1;min-height:44px;}
  .pm-danger {color:var(--bad);border-color:var(--bad);}
</style>
