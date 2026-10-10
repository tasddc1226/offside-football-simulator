<script lang="ts">
  import Topbar from '../Topbar.svelte';
  import BackBar from '../BackBar.svelte';
  import { go } from '../nav.js';
  import { appState } from '../state.svelte.js';
  import { ownerProfileText as L } from '@offside/app-core/i18n/ko/ownerProfile';
  import OwnerHall from './OwnerHall.svelte';
  import OwnerArchive from './OwnerArchive.svelte';
  let visitedTitles = $state(appState.honorsView === 'titles');
  let visitedRecords = $state(appState.honorsView !== 'titles');
  function tab(view: 'records' | 'titles') {
    appState.honorsView = view;
    if (view === 'titles') visitedTitles = true;
    else visitedRecords = true;
  }
</script>

<div class="wrap honors" data-owner-honors-screen>
  <Topbar />
  <BackBar inline act="honors-back" fallback={() => go('owner')} />
  <header class="hall-heading"><h1>{L.hallTitle}</h1><p class="muted">{L.archiveLead}</p></header>
  <div class="hall-tabs" role="group" aria-label={L.hallTitle}>
    <button aria-pressed={appState.honorsView === 'records'} data-hall-tab="records" onclick={() => tab('records')}>{L.archiveTab}{#if appState.recapNew}<span class="hall-dot" aria-label={L.archiveNew}></span>{/if}</button>
    <button aria-pressed={appState.honorsView === 'titles'} data-hall-tab="titles" onclick={() => tab('titles')}>{L.titlesTab}</button>
  </div>
  {#if visitedRecords}<div hidden={appState.honorsView !== 'records'}><OwnerArchive /></div>{/if}
  {#if visitedTitles}<div hidden={appState.honorsView !== 'titles'}><OwnerHall /></div>{/if}
</div>

<style>
  .hall-heading h1 {font-size:28px;margin:0 0 6px;}.hall-heading p {margin:0;line-height:1.6;}
  .hall-tabs {display:flex;border-bottom:1px solid var(--line);gap:20px;}
  .hall-tabs button {display:flex;align-items:center;justify-content:center;gap:6px;min-height:48px;padding:10px 4px;background:none;border:0;border-bottom:3px solid transparent;color:var(--muted);font-weight:700;}
  .hall-tabs button[aria-pressed=true] {color:var(--ink);border-bottom-color:var(--accent);}
  .hall-dot {width:6px;height:6px;border-radius:50%;background:var(--accent);}
</style>
