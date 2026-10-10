<script lang="ts">
  import type { CupMatch } from '@offside/app-core/api/cup';
  import { predictionOpen, predictionChoices, predictionPercentages, type CupPredictionContext } from '@offside/app-core/cupPredictions';
  import { cupText as L } from '@offside/app-core/i18n/ko/cup';
  let { m, prediction }: { m: CupMatch; prediction: CupPredictionContext } = $props();
  const counts = $derived(prediction.state.counts[m.id]);
  const mine = $derived(prediction.state.mine[m.id]);
  const shares = $derived(predictionPercentages(counts));
  const total = $derived(counts ? counts.home + counts.draw + counts.away : 0);
  const open = $derived(predictionOpen(m, prediction.now));
  const choices = $derived(predictionChoices(m));
  const note = $derived(
    prediction.state.busy === m.id ? L.predictionSaving :
    mine?.correct === true ? `${L.predictionHit} · ${mine.rewarded ? L.predictionRewarded : L.predictionPending}` :
    mine?.correct === false ? L.predictionMiss :
    !open ? (mine ? L.predictionPending : m.played ? '' : L.predictionClosed) :
    !total ? L.predictionEmpty : '',
  );
  const disabled = $derived(!open || !prediction.linked || !!prediction.state.busy || prediction.state.personalFailed);
  const label = (k: 'home' | 'draw' | 'away') => k === 'draw' ? L.predictionDraw : k === 'home' ? L.predictionHome : L.predictionAway;
</script>

<div class="cp" data-cup-prediction={m.id}>
  {#if prediction.state.status === 'ready' && m.homeTeamId && m.awayTeamId}
    <div class="cp-head"><b>{L.predictionShares}</b></div>
    <div class="cp-choices" role="group" aria-label={L.predictionTitle}>
      {#each choices as k (k)}
        {@const selected = mine?.pick === k}
        <button class="cp-choice" class:selected aria-pressed={selected} {disabled} onclick={() => prediction.pick(m.id, k)}>
          <span class="cp-outcome">{label(k)}<span class="cp-check" aria-hidden="true">{selected ? '✓' : ''}</span></span>
          <b class="cp-share">{shares[k]}<small>%</small></b>
          <span class="cp-track" aria-hidden="true"><span style:width="{shares[k]}%"></span></span>
          {#if selected || (open && prediction.linked)}<span class="cp-action">{selected ? L.predictionSelected : L.predictionPick}</span>{/if}
        </button>
      {/each}
    </div>
    {#if note}<p class="muted fs-xs" aria-live="polite">{note}</p>{/if}
  {/if}
  {#if prediction.state.errorMatch === m.id}<p role="alert">{prediction.state.error}</p>{/if}
</div>
<style>
  .cp { padding: 2px 0 18px; display: grid; gap: 10px; }
  .cp-head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 4px 8px; }
  .cp-head b { font-size: .8125rem; }
  .cp-choices { display: flex; gap: 6px; }
  .cp-choice { display: flex; flex-direction: column; gap: 10px; flex: 1; min-width: 0; min-height: 112px; padding: 10px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface-2); color: var(--ink); font: inherit; text-align: left; cursor: pointer; transition: background-color 120ms, border-color 120ms; }
  .cp-outcome { display: flex; align-items: center; justify-content: space-between; gap: 4px; font-size: .75rem; font-weight: 600; }
  .cp-check { display: grid; place-items: center; width: 14px; height: 14px; flex: none; border: 1px solid var(--muted); border-radius: 50%; font-size: 10px; }
  .cp-share { font-family: var(--display); font-size: 1.75rem; line-height: 1; font-variant-numeric: tabular-nums; }
  .cp-share small { font-family: inherit; font-size: .875rem; margin-left: 2px; }
  .cp-track { display: block; height: 4px; overflow: hidden; background: var(--line); border-radius: 3px; }
  .cp-track > span { display: block; height: 100%; background: var(--muted); border-radius: inherit; }
  .cp-action { color: var(--muted); font-size: .6875rem; font-weight: 600; }
  .cp-choice.selected { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
  .cp-choice.selected .cp-action { color: inherit; }
  .cp-choice.selected .cp-check { background: var(--accent-ink); border-color: var(--accent-ink); color: var(--accent); }
  .cp-choice.selected .cp-track { background: color-mix(in srgb, var(--accent-ink) 18%, transparent); }
  .cp-choice.selected .cp-track > span { background: var(--accent-ink); }
  .cp-choice:disabled { cursor: default; }
  .cp-choice:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
  @media (hover: hover) { .cp-choice:not(:disabled):not(.selected):hover { border-color: var(--accent); } }
  @media (prefers-reduced-motion: reduce) { .cp-choice { transition: none; } }
  .cp p { margin: 0; }
</style>
