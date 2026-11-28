<script lang="ts">
  import Skeleton from '../Skeleton.svelte';
  import { onMount } from 'svelte';
  import { PlayerManagement, MANAGE_SORTS, MANAGE_SORT_LABEL, MANAGE_PAGE, manageNations, manageRowInfo, manageLockTag, manageView, type ManageSort } from '@offside/app-core/playerManagement';
  import { releaseLock, releaseAmount, releaseValue, releaseConfirmText, fundsText, nationName, MARKET_POS_FILTERS } from '@offside/app-core/market';
  import type { TeamPlayer as Player } from '@offside/app-core/api/team';
  import { CARD_TIER_SWATCH } from '@offside/app-core/seasonRecap';
  import { cardTier } from '@offside/contracts/card-tier';
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
  // 이름 검색은 화면에 보이는 이름(바꾼 이름 · 이 기기 이름)으로 한다.
  const manager = new PlayerManagement((p) => nameOf(p));
  let pm = $state(manager.state);
  const local = localCareerNames();
  // T-11-377 이름 변경권으로 바꾼 이름(목록을 다시 받기 전까지 바로 보인다)과 열린 창의 선수.
  let renamed = $state<Record<string, string>>({});
  let renaming = $state<{ careerId: string; name: string } | null>(null);
  const nameOf = (p: Player) => renamed[p.careerId] ?? local.get(p.careerId) ?? playerName(p.publicName, p.pos, p.number);
  const selected = $derived(pm.players.filter(p => pm.selected.has(p.careerId) && !releaseLock(p, pm.lineup)));
  const amount = $derived(releaseAmount(selected, pm.rate));
  // T-11-841 포지션 · 국적 · 이름으로 거르고 정렬한다(받은 목록 안에서만, 서버를 다시 부르지 않는다).
  const shown = $derived(manageView(pm.players, pm.filter, pm.sort, nameOf));
  const nations = $derived(manageNations(pm.players));
  const filtered = $derived(!!(pm.filter.pos || pm.filter.nation || pm.filter.q));
  // 수백 명이어도 처음엔 MANAGE_PAGE명만 그린다. 필터 · 정렬을 바꾸면 다시 처음부터.
  let limit = $state(MANAGE_PAGE);
  $effect(() => { void pm.filter; void pm.sort; limit = MANAGE_PAGE; });
  const rows = $derived(shown.slice(0, limit));
  // 줄의 ⋯ 메뉴(이름 · 체격 바꾸기)와 잠금 배지를 눌러 펼친 이유.
  let menuFor = $state<string | null>(null);
  let whyFor = $state<string | null>(null);
  const swatch = (p: Player) => CARD_TIER_SWATCH[cardTier(p.legendScore, p.peak)];
  onMount(() => { const unsubscribe = manager.subscribe(s => pm = s); return () => { unsubscribe(); manager.dispose(); }; });
  $effect(() => { void manager.load(season); });
</script>

<svelte:window onclick={(e) => { if (menuFor && !(e.target as Element).closest?.('[data-player-menu-wrap]')) menuFor = null; }} onkeydown={(e) => { if (e.key === 'Escape') menuFor = null; }} />

<div class="pm" data-player-management aria-busy={pm.busy || pm.loading}>
  <p class="muted fs-sm">{M.releaseIntro}</p>
  {#if pm.notice}<p role="status" class="good">{pm.notice}</p>{/if}
  {#if pm.error}<p role="alert">{pm.error}</p><button class="btn" disabled={pm.busy} onclick={() => manager.load(season)}>{L.retry}</button>{/if}
  {#if pm.loading}<Skeleton rows={5} />{:else}
    {#if pm.players.length}
      <div class="pm-filters" data-players-filters>
        <input class="pm-search" type="search" id="players-search" value={pm.filter.q ?? ''} placeholder={L.searchPlaceholder} aria-label={L.searchLabel} data-players-search oninput={(e) => manager.setFilter({ q: e.currentTarget.value || undefined })} />
        <div class="pm-chips" role="group" aria-label={L.filterPos}>
          {#each MARKET_POS_FILTERS as pos (pos ?? 'all')}
            <button class="pm-chip" aria-pressed={pm.filter.pos === pos} data-players-pos={pos ?? 'all'} onclick={() => manager.setFilter({ pos })}>{pos ? tn(POS_LABEL[pos]) : M.posAll}</button>
          {/each}
        </div>
        <div class="pm-selects">
          <label>{L.filterNation}
            <select id="players-nation" value={pm.filter.nation ?? ''} data-players-nation onchange={(e) => manager.setFilter({ nation: e.currentTarget.value || undefined })}>
              <option value="">{L.nationAll}</option>
              {#each nations as n (n.code)}<option value={n.code}>{nationName(n.code)} ({n.n})</option>{/each}
            </select>
          </label>
          <label>{L.sortLabel}
            <select id="players-sort" value={pm.sort} data-players-sort onchange={(e) => manager.setSort(e.currentTarget.value as ManageSort)}>
              {#each MANAGE_SORTS as k (k)}<option value={k}>{MANAGE_SORT_LABEL[k]()}</option>{/each}
            </select>
          </label>
        </div>
        <div class="pm-count">
          <span class="muted fs-sm" data-players-count>{L.shownCount({ n: shown.length, total: pm.players.length })}</span>
          {#if filtered}<button class="pm-link" data-players-reset onclick={() => manager.setFilter({ pos: undefined, nation: undefined, q: undefined })}>{L.filterReset}</button>{/if}
          <button class="pm-link pm-pick-all" data-act="players-pick-all" disabled={pm.busy || pm.confirm || !manager.eligible.length} onclick={() => manager.selectAll()}>{pm.selected.size ? M.pickNone : L.pickLimit}</button>
        </div>
      </div>
    {/if}
    <ul class="pm-list">
      {#each rows as p (p.careerId)}
        {@const locked = releaseLock(p, pm.lineup)}
        {@const tag = manageLockTag(p, pm.lineup)}
        {@const sw = swatch(p)}
        {@const name = nameOf(p)}
        <li class="pm-row" class:on={pm.selected.has(p.careerId)} data-managed-player={p.careerId}>
          <label class="pm-check">
            <input type="checkbox" checked={pm.selected.has(p.careerId)} disabled={!!locked || pm.busy || pm.confirm} aria-label={M.releasePickLabel({ name })} aria-describedby={locked ? `why-${p.careerId}` : undefined} onchange={() => manager.toggle(p.careerId)} />
          </label>
          <button class="pm-main" data-player-detail={p.careerId} aria-label={L.openRecord({ name })} disabled={pm.busy} onclick={() => openPublicLegendById(p.careerId)}>
            <span class="pm-ovr num" style="--c-base:{sw.base};--c-ink:{sw.ink};--c-line:{sw.line}" aria-hidden="true">{p.peak}</span>
            <span class="pm-text"><b>{name}</b><small data-release-info>{manageRowInfo(p)}</small></span>
          </button>
          {#if tag}
            <button class="pm-tag" aria-expanded={whyFor === p.careerId} aria-controls={`why-${p.careerId}`} data-release-tag onclick={() => (whyFor = whyFor === p.careerId ? null : p.careerId)}>{tag}</button>
          {:else}
            <span class="pm-value"><small>{L.releaseValueLabel}</small><b class="num" data-release-gets>{fundsText(releaseValue(p, pm.rate))}</b></span>
          {/if}
          <span class="pm-menu-wrap" data-player-menu-wrap>
            <button class="pm-more" aria-label={L.moreActions({ name })} aria-haspopup="menu" aria-expanded={menuFor === p.careerId} data-player-more={p.careerId} disabled={pm.busy} onclick={() => (menuFor = menuFor === p.careerId ? null : p.careerId)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
            </button>
            {#if menuFor === p.careerId}
              <div class="pm-menu" role="menu">
                <button role="menuitem" data-player-rename={p.careerId} aria-label={RN.entryLabel({ name })} onclick={() => { menuFor = null; renaming = { careerId: p.careerId, name }; }}>{RN.entry}</button>
                {#if physiqueOn}<button role="menuitem" data-player-physique={p.careerId} onclick={() => { menuFor = null; returning = null; editing = { id: p.careerId, name }; }}>{I.physiqueTitle}</button>{/if}
              </div>
            {/if}
          </span>
          {#if locked}<small class="pm-why muted" id={`why-${p.careerId}`} hidden={whyFor !== p.careerId}>{locked}</small>{/if}
        </li>
      {:else}<li class="empty">{pm.players.length ? L.filterEmpty : L.noOwned}</li>{/each}
    </ul>
    {#if shown.length > rows.length}
      <button class="btn" data-players-more onclick={() => (limit += MANAGE_PAGE)}>{L.showMore({ n: shown.length - rows.length })}</button>
    {/if}
    {#if selected.length}
      <section class="pm-dock" data-player-release-summary aria-label={M.dockLabel}>
        <div class="pm-dock-sum"><span>{M.dockSum({ n: selected.length })}</span><b class="num">+{fundsText(amount)}</b></div>
        {#if pm.confirm}
          <p>{releaseConfirmText(selected.length, amount)}</p>
          {#if enhanceLossNote(selected)}<p class="fs-sm" data-enhance-loss>{enhanceLossNote(selected)}</p>{/if}
          <div class="pm-actions"><button class="btn" disabled={pm.busy} onclick={() => manager.confirm(false)}>{M.close}</button><button class="btn pm-danger" data-act="players-release-confirm" disabled={pm.busy} onclick={() => manager.release()}>{M.releaseBtn({n:selected.length})}</button></div>
        {:else}<p class="pm-warn">{M.dockWarn}</p><button class="btn pm-danger" data-act="players-release" disabled={pm.busy} onclick={() => manager.confirm(true)}>{M.releaseBtn({n:selected.length})}</button>{/if}
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
  .pm {display:flex;flex-direction:column;gap:12px;}
  .pm-filters {display:flex;flex-direction:column;gap:10px;}
  .pm-search {width:100%;min-height:42px;padding:0 12px;font:inherit;color:var(--ink);border:1px solid var(--line);border-radius:var(--radius-md);background:var(--surface);}
  /* 포지션 칩은 좁은 화면에서도 한 줄(넘치면 가로로 민다). */
  .pm-chips {display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;margin-inline:-2px;padding:2px;}
  .pm-chips::-webkit-scrollbar {display:none;}
  .pm-chip {flex:none;min-height:36px;padding:0 14px;border-radius:var(--radius-pill);border:1px solid var(--line);background:var(--surface);color:var(--ink);font:inherit;font-size:var(--fs-label);white-space:nowrap;cursor:pointer;}
  .pm-chip[aria-pressed='true'] {border-color:var(--ink);background:var(--ink);color:var(--surface);font-weight:600;}
  .pm-selects {display:flex;flex-wrap:wrap;gap:8px;}
  .pm-selects label {display:flex;align-items:center;gap:6px;flex:1 1 140px;color:var(--muted);font-size:var(--fs-label);}
  .pm-selects select {flex:1;min-width:0;min-height:40px;font:inherit;color:var(--ink);border:1px solid var(--line);border-radius:var(--radius-sm);background:var(--surface);padding:4px 6px;}
  .pm-count {display:flex;align-items:center;gap:10px;min-height:32px;}
  .pm-link {border:0;padding:6px 0;background:none;color:var(--accent-text);font:inherit;font-size:var(--fs-label);cursor:pointer;text-decoration:underline;}
  .pm-link:disabled {color:var(--muted);cursor:default;text-decoration:none;}
  .pm-pick-all {margin-left:auto;text-decoration:none;font-weight:600;}
  .pm-list {list-style:none;margin:0;padding:0;display:flex;flex-direction:column;}
  /* 한 줄: 체크 · (OVR 배지 + 이름 · 정보 = 누르면 기록) · 방출 자금 또는 잠금 배지 · ⋯ */
  .pm-row {display:grid;grid-template-columns:auto minmax(0,1fr) auto auto;align-items:center;column-gap:4px;border-top:1px solid var(--line);min-height:64px;}
  .pm-row.on {background:color-mix(in srgb, var(--bad) 7%, transparent);}
  .pm-check {display:flex;align-items:center;justify-content:center;width:40px;height:56px;cursor:pointer;}
  .pm-check input {width:20px;height:20px;margin:0;accent-color:var(--bad);}
  .pm-main {display:flex;align-items:center;gap:10px;min-width:0;min-height:56px;padding:6px 4px;border:0;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer;border-radius:var(--radius-sm);}
  .pm-main:hover .pm-text b {text-decoration:underline;}
  .pm-ovr {flex:none;display:grid;place-items:center;width:38px;height:38px;border-radius:9px;background:var(--c-base);color:var(--c-ink);box-shadow:inset 0 0 0 1.5px var(--c-line);font-family:var(--display);font-size:16px;font-weight:800;}
  .pm-text {display:flex;flex-direction:column;gap:2px;min-width:0;}
  .pm-text b {overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .pm-text small {color:var(--muted);font-size:var(--fs-caption);overflow-wrap:anywhere;}
  .pm-value {display:flex;flex-direction:column;align-items:flex-end;gap:1px;white-space:nowrap;padding-left:4px;}
  .pm-value small {font-size:11px;color:var(--muted);}
  .pm-value b {font-size:var(--fs-label);}
  .pm-tag {min-height:28px;padding:0 10px;border:1px solid var(--line);border-radius:var(--radius-pill);background:var(--surface-2);color:var(--muted);font:inherit;font-size:12px;font-weight:600;white-space:nowrap;cursor:pointer;}
  .pm-menu-wrap {position:relative;}
  .pm-more {display:grid;place-items:center;width:40px;height:44px;border:0;background:none;color:var(--muted);cursor:pointer;border-radius:var(--radius-sm);}
  .pm-menu {position:absolute;right:0;top:calc(100% - 4px);z-index:5;display:flex;flex-direction:column;min-width:150px;padding:6px;border:1px solid var(--line);border-radius:var(--radius-md);background:var(--surface);box-shadow:var(--shadow);}
  .pm-menu button {min-height:44px;padding:0 12px;border:0;background:none;color:var(--ink);font:inherit;text-align:left;border-radius:var(--radius-sm);cursor:pointer;}
  .pm-menu button:hover,.pm-menu button:focus-visible {background:var(--surface-2);}
  .pm-why {grid-column:2 / -1;padding:0 4px 10px;font-size:var(--fs-caption);}
  /* 고른 선수 합계는 목록이 길어도 화면 아래에 붙어 있다(이전으로 바 위). */
  .pm-dock {position:sticky;bottom:calc(var(--bottom-bar-h, 0px) + 8px);z-index:4;display:flex;flex-direction:column;gap:8px;padding:14px 16px;border-radius:var(--radius-lg);background:var(--surface);box-shadow:var(--shadow);}
  .pm-dock p {margin:0;}
  .pm-dock-sum {display:flex;justify-content:space-between;align-items:baseline;gap:8px;font-size:var(--fs-body2);}
  .pm-dock-sum b {font-family:var(--display);font-size:var(--fs-title1);color:var(--accent-text);}
  .pm-warn {font-size:var(--fs-caption);color:var(--bad);}
  .pm-actions {display:flex;gap:8px;flex-wrap:wrap;}
  .pm-actions button {flex:1;min-height:44px;}
  .pm-danger {border:0;background:var(--bad);color:#fff;}
  .pm-dock > .pm-danger {min-height:44px;}
</style>
