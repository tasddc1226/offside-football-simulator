<script lang="ts">
  import { onMount } from 'svelte';
  import { playerNudge, takePlayerNudge, notePlayerVisit, PLAYER_NUDGE_DELAY, type PlayerNudge } from '@offside/app-core/player-nudge';
  import { playerNudgeText as L } from '@offside/app-core/i18n/ko/playerNudge';
  import { appState } from './state.svelte.js';
  import { sheetState } from './sheetState.svelte.js';
  import { lockScroll } from './scrollLock.js';
  const { openPlayer }: { openPlayer: () => void } = $props();
  const candidate = $derived(appState.G ? playerNudge(appState.G) : null);
  let shown = $state<PlayerNudge | null>(null);
  let active = $state(true);
  onMount(() => {
    const update = () => (active = !document.hidden);
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  });
  $effect(() => {
    const n = candidate;
    shown = null;
    if (appState.tab === 'player') notePlayerVisit(n);
    if (!n || !active || appState.tab !== 'season' || sheetState.open || sheetState.busy) return;
    const timer = setTimeout(() => {
      if (takePlayerNudge(n)) shown = n;
    }, PLAYER_NUDGE_DELAY);
    return () => clearTimeout(timer);
  });
  // T-11-212 화면 가운데 대화창. 저절로 닫히지 않고, 버튼·Esc·바깥 누르기로 닫는다.
  let dialog = $state<HTMLDialogElement>();
  $effect(() => {
    if (!shown || !dialog) return;
    if (!dialog.open) dialog.showModal();
    const unlock = lockScroll();
    return () => { unlock(); if (dialog?.open) dialog.close(); };
  });
  function go() { shown = null; openPlayer(); }
</script>

{#if shown}
  <dialog bind:this={dialog} class="player-nudge" data-player-nudge aria-labelledby="player-nudge-title" aria-describedby="player-nudge-text"
    onclose={() => (shown = null)} onclick={(e) => { if (e.target === dialog) dialog?.close(); }}>
    <div class="nudge-body">
      <strong id="player-nudge-title">{shown.title}</strong>
      <p id="player-nudge-text">{shown.text}</p>
      <div class="nudge-actions">
        <button class="btn btn-primary" onclick={go}>{L.open}</button>
        <button class="btn" aria-label={L.closeAria} onclick={() => dialog?.close()}>{L.close}</button>
      </div>
    </div>
  </dialog>
{/if}

<style>
  :global(body:has([data-player-nudge]) [data-tab='player']) { background: var(--surface); outline: 2px solid var(--accent); outline-offset: -3px; border-radius: var(--radius-sm); }
  .player-nudge { box-sizing: border-box; width: min(360px, calc(100% - 32px)); max-width: 100%; padding: 0; border: 1px solid var(--accent); border-radius: var(--radius-lg); background: var(--surface); color: var(--ink); text-align: center; }
  .player-nudge::backdrop { background: #0009; }
  .nudge-body { padding: 20px; }
  strong { display: block; font-size: var(--fs-title3); }
  p { font-size: var(--fs-body2); line-height: 1.6; margin: 8px 0 16px; }
  .nudge-actions { display: flex; gap: 8px; }
  button { min-height: 44px; }
  .btn-primary { flex: 1; }
</style>
