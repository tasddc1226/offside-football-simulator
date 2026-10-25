<script lang="ts">
  // T-11-500 이적시장 '국적 · 팀으로 찾기' 시트(시안 A). 열 때 고를 거리(매물이 있는 국적 · 리그 · 클럽과 수)를 한 번 받고(1분 메모),
  // 검색창은 받은 목록을 기기 안에서만 좁힌다. 고르면 바로 목록에 걸고 닫는다.
  import { untrack } from 'svelte';
  import Skeleton from './Skeleton.svelte';
  import ClubMark from './ClubMark.svelte';
  import { fetchMarketFacets, type MarketFacetsResponse } from '@offside/app-core/api/market';
  import {
    findClubs,
    findLeagueOf,
    findLeagues,
    findNations,
    leagueName,
    clubName,
    nationName,
    type MarketFilter,
  } from '@offside/app-core/market';
  import { marketText as L } from '@offside/app-core/i18n/ko/market';
  import { intlLocale } from '@offside/contracts/i18n';

  const {
    filter,
    onpick,
    onclose,
  }: { filter: MarketFilter; onpick: (next: MarketFilter) => void; onclose: () => void } = $props();

  // 팀을 고른 채로 열면 팀 탭부터(처음 한 번만 본다).
  let tab = $state<'nation' | 'team'>(untrack(() => (filter.league || filter.club ? 'team' : 'nation')));
  let query = $state('');
  let facets = $state<MarketFacetsResponse | null>(null);
  let failed = $state(false);
  async function load() {
    failed = false;
    const r = await fetchMarketFacets();
    if (r.ok) facets = r.data;
    else failed = true;
  }
  void load();

  let league = $state<string | undefined>(undefined);
  const openLeague = $derived(league ?? findLeagueOf(filter, facets));
  const nations = $derived(facets ? findNations(facets, query) : []);
  const leagues = $derived(facets ? findLeagues(facets, tab === 'team' ? query : '') : []);
  const clubs = $derived(facets ? findClubs(facets, openLeague, query) : []);
  const leagueN = $derived(facets?.leagues.find((l) => l.id === openLeague)?.n ?? 0);
  const fmt = (n: number) => n.toLocaleString(intlLocale());

  function pick(next: MarketFilter) {
    onpick(next);
    onclose();
  }
  function switchTab(t: 'nation' | 'team') {
    tab = t;
    query = '';
  }
  const onkey = (e: KeyboardEvent) => e.key === 'Escape' && onclose();
</script>

<svelte:window onkeydown={onkey} />
<button class="mk-scrim" aria-label={L.findClose} onclick={onclose}></button>
<div class="mf-sheet" role="dialog" aria-modal="true" aria-label={L.findTitle} data-market-find>
  <div class="mf-head">
    <h2>{L.findTitle}</h2>
    <button class="mf-x" aria-label={L.findClose} onclick={onclose}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
    </button>
  </div>
  <div class="mf-tabs" role="tablist">
    <button role="tab" aria-selected={tab === 'nation'} data-find-tab="nation" onclick={() => switchTab('nation')}>
      {filter.nation ? L.findTabNationOn({ name: nationName(filter.nation) }) : L.findTabNation}
    </button>
    <button role="tab" aria-selected={tab === 'team'} data-find-tab="team" onclick={() => switchTab('team')}>
      {filter.club ? L.findTabTeamOn({ name: clubName(filter.club) }) : filter.league ? L.findTabTeamOn({ name: leagueName(filter.league) }) : L.findTabTeam}
    </button>
  </div>
  <label class="mf-search">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
    <input type="search" bind:value={query} placeholder={tab === 'nation' ? L.findNationSearch : L.findTeamSearch} aria-label={tab === 'nation' ? L.findNationSearch : L.findTeamSearch} data-find-query />
  </label>

  <div class="mf-body">
    {#if failed}
      <p class="muted">{L.findFailed}</p>
      <button class="btn btn-block" onclick={load}>{L.reload}</button>
    {:else if !facets}
      <Skeleton rows={6} />
    {:else if tab === 'nation'}
      <div class="mf-cap">
        <span>{L.findNationCaption({ n: facets.nations.length })}</span>
        {#if filter.nation}<button class="mf-clear" data-find-clear="nation" onclick={() => pick({ nation: undefined })}>{L.findClearNation}</button>{/if}
      </div>
      <ul class="mf-list">
        {#each nations as x (x.id)}
          <li>
            <button class="mf-opt" aria-pressed={filter.nation === x.id} data-find-nation={x.id} onclick={() => pick({ nation: x.id })}>
              <span class="mf-code">{x.id.replace('GB-', '')}</span>
              <span class="mf-name">{x.name}</span>
              <b class="num" aria-label={L.findCount({ n: x.n })}>{fmt(x.n)}</b>
            </button>
          </li>
        {:else}
          <li class="muted mf-none">{L.findNone}</li>
        {/each}
      </ul>
    {:else}
      <div class="mf-cap">
        <span>{L.findLeagueCaption}</span>
        {#if filter.league || filter.club}<button class="mf-clear" data-find-clear="team" onclick={() => pick({ league: undefined, club: undefined })}>{L.findClearTeam}</button>{/if}
      </div>
      <div class="mf-leagues">
        {#each leagues as x (x.id)}
          <button class="mf-league" aria-pressed={openLeague === x.id} data-find-league={x.id} onclick={() => ((league = x.id), (query = ''))}>
            {x.name} <b class="num">{fmt(x.n)}</b>
          </button>
        {/each}
      </div>
      <div class="mf-cap"><span>{L.findClubCaption}</span></div>
      <ul class="mf-list">
        {#if !query && openLeague}
          <li>
            <button class="mf-opt mf-all" aria-pressed={filter.league === openLeague} data-find-league-all={openLeague} onclick={() => pick({ league: openLeague })}>
              <span class="mf-name">{L.findLeagueAll({ name: leagueName(openLeague) })}</span>
              <b class="num">{fmt(leagueN)}</b>
            </button>
          </li>
        {/if}
        {#each clubs as x (x.id)}
          <li>
            <button class="mf-opt" aria-pressed={filter.club === x.id} data-find-club={x.id} onclick={() => pick({ club: x.id })}>
              <span class="mf-mark"><ClubMark name={x.name} id={x.id} size={22} /></span>
              <span class="mf-name">{x.name}</span>
              <b class="num" aria-label={L.findCount({ n: x.n })}>{fmt(x.n)}</b>
            </button>
          </li>
        {:else}
          {#if query}<li class="muted mf-none">{L.findNone}</li>{/if}
        {/each}
      </ul>
    {/if}
  </div>
</div>

<style>
  .mk-scrim {
    position: fixed;
    inset: 0;
    z-index: 60;
    border: 0;
    padding: 0;
    background: rgb(0 0 0 / 0.45);
  }
  .mf-sheet {
    position: fixed;
    z-index: 61;
    left: 50%;
    bottom: 0;
    transform: translateX(-50%);
    width: min(100%, 560px);
    height: min(88vh, 760px);
    display: flex;
    flex-direction: column;
    gap: 12px;
    box-sizing: border-box;
    padding: 12px 16px 0;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    background: var(--surface);
    color: var(--ink);
    box-shadow: var(--shadow);
  }
  .mf-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .mf-head h2 {
    margin: 0;
    font-size: var(--fs-title3);
  }
  .mf-x {
    width: 44px;
    height: 44px;
    margin-right: -10px;
    border: 0;
    background: none;
    color: var(--muted);
    display: grid;
    place-items: center;
    cursor: pointer;
  }
  .mf-tabs {
    display: flex;
    gap: 4px;
    padding: 4px;
    border-radius: var(--radius-md);
    background: var(--bg);
  }
  .mf-tabs button {
    flex: 1;
    min-width: 0;
    min-height: 38px;
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--muted);
    font: inherit;
    font-size: var(--fs-label);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
  }
  .mf-tabs button[aria-selected='true'] {
    background: var(--surface-2);
    color: var(--ink);
    font-weight: 700;
  }
  .mf-search {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 46px;
    padding: 0 14px;
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    background: var(--bg);
    color: var(--muted);
  }
  .mf-search input {
    flex: 1;
    min-width: 0;
    border: 0;
    background: none;
    color: var(--ink);
    font: inherit;
    outline: none;
  }
  .mf-search:focus-within {
    border-color: var(--accent);
  }
  .mf-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-bottom: calc(16px + var(--safe-b));
  }
  .mf-cap {
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: var(--muted);
    font-size: var(--fs-caption);
  }
  .mf-clear {
    border: 0;
    padding: 0;
    background: none;
    color: var(--accent-text);
    font: inherit;
    cursor: pointer;
  }
  .mf-leagues {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .mf-league {
    min-height: 34px;
    padding: 0 12px;
    border: 1px solid var(--line);
    border-radius: var(--radius-pill);
    background: var(--bg);
    color: var(--ink);
    font: inherit;
    font-size: var(--fs-label);
    cursor: pointer;
  }
  .mf-league b {
    margin-left: 4px;
    color: var(--muted);
  }
  .mf-league[aria-pressed='true'] {
    border-color: var(--ink);
    background: var(--ink);
    color: var(--surface);
    font-weight: 600;
  }
  .mf-league[aria-pressed='true'] b {
    color: var(--surface);
  }
  .mf-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .mf-opt {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 48px;
    padding: 0 4px;
    border: 0;
    border-bottom: 1px solid var(--line);
    background: none;
    color: var(--ink);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .mf-opt b {
    margin-left: auto;
    color: var(--muted);
  }
  .mf-opt[aria-pressed='true'],
  .mf-opt[aria-pressed='true'] b,
  .mf-all,
  .mf-all b {
    color: var(--accent-text);
    font-weight: 700;
  }
  .mf-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .mf-code {
    flex: none;
    min-width: 34px;
    padding: 2px 4px;
    border-radius: 4px;
    background: var(--surface-2);
    color: var(--muted);
    font-size: var(--fs-caption2);
    font-weight: 700;
    text-align: center;
  }
  .mf-mark {
    flex: none;
    width: 22px;
    display: grid;
    place-items: center;
  }
  .mf-none {
    padding: 16px 4px;
  }
</style>
