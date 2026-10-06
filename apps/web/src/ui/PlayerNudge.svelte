<script lang="ts">
  import { onMount } from 'svelte';
  import { playerNudge, takePlayerNudge, notePlayerVisit, PLAYER_NUDGE_DELAY, PLAYER_NUDGE_MS, type PlayerNudge } from '@offside/app-core/player-nudge';
  import { playerNudgeText as L } from '@offside/app-core/i18n/ko/playerNudge';
  import { appState } from './state.svelte.js';
  import { sheetState } from './sheetState.svelte.js';
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
    let hide: ReturnType<typeof setTimeout>;
    const timer = setTimeout(() => {
      if (!takePlayerNudge(n)) return;
      shown = n;
      hide = setTimeout(() => (shown = null), PLAYER_NUDGE_MS);
    }, PLAYER_NUDGE_DELAY);
    return () => { clearTimeout(timer); clearTimeout(hide); };
  });
</script>

{#if shown}
  <aside class="player-nudge" data-player-nudge aria-label={L.aria}>
    <div aria-live="polite"><strong>{shown.title}</strong><p>{shown.text}</p></div>
    <div class="nudge-actions">
      <button class="btn btn-primary" onclick={() => { shown = null; openPlayer(); }}>{L.open}</button>
      <button class="btn" aria-label={L.closeAria} onclick={() => (shown = null)}>{L.close}</button>
    </div>
  </aside>
{/if}

<style>
  :global(body:has([data-player-nudge]) [data-tab='player']) { background: var(--surface); outline: 2px solid var(--accent); outline-offset: -3px; border-radius: 9px; }
  .player-nudge { padding: 12px; border: 1px solid var(--accent); border-radius: 12px; background: var(--surface); margin-bottom: 8px; }
  strong { font-size: .9375rem; }
  p { font-size: .8125rem; line-height: 1.5; margin: 5px 0 10px; }
  .nudge-actions { display: flex; gap: 8px; }
  button { min-height: 44px; }
  .btn-primary { flex: 1; }
</style>
