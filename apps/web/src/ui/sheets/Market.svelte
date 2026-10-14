<script lang="ts">
  import { careerMomentText as CM } from '@offside/app-core/i18n/ko/careerMoment';
  import { dismissSheet } from '../sheetState.svelte.js';
  import { shellMoreText as S } from '@offside/app-core/i18n/ko/shellMore';
  import { pickOption } from '../actions.js';
  import type { SheetView } from '@offside/app-core/sheets';
  import ClubBadge from '../ClubBadge.svelte';
  import { sheetPlayText as L } from '@offside/app-core/i18n/ko/sheetPlay';
  let { v }: { v: Extract<SheetView, { kind: 'market' }> } = $props();
  function close() {
    dismissSheet();
    document.querySelector<HTMLButtonElement>('[data-act="resume"]')?.focus({ preventScroll: true });
  }
</script>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape') { e.preventDefault(); close(); } }} />

<div class="eyebrow">{v.eyebrow}</div>
<div class="market-heading"><h2>{L.marketTitle}</h2><button class="icon-btn" data-market-close aria-label={S.close} onclick={close}><span aria-hidden="true">✕</span></button></div>
<p class="muted">{v.note}</p>
{#if v.assessment}<p class="fs-sm" data-market-feedback>{v.assessment}</p>{/if}
<p class="muted fs-sm">{L.marketHint}</p>
<p class="muted fs-sm">{L.marketDismissHint}</p>
<div class="stack">
  {#if v.options.some((o) => o.destination)}<p class="muted fs-xs" data-transfer-estimate>{CM.estimateNote}</p>{/if}
{#each v.options as o, i (i)}
    <button class="offer" data-opt={i} onclick={() => pickOption(i)}>
      <div class="offer-club">{#if o.clubId}<ClubBadge club={{ id: o.clubId, name: o.name }} size={30} />{/if}<div><b>{o.name}</b><div class="lg">{o.lg}</div></div></div>
      <div class="offer-end">
        {#if o.salary !== null}<div class="sal">{o.salary}<div class="lg" style="text-align:right">{L.salary}</div></div>{/if}
        <span class="offer-chev" aria-hidden="true">›</span>
      </div>
      {#if o.sub}<div class="sub">{o.sub}</div>{/if}
      {#if o.destination}<div class="sub destination" data-transfer-outlook>{o.destination}</div>{/if}
      {#if o.reason}<div class="sub" data-offer-feedback>{o.reason}</div>{/if}
    </button>
  {/each}
</div>

<style>
.market-heading { display: flex; align-items: flex-start; gap: 8px; }
.market-heading h2 { flex: 1; }
.market-heading button { flex-shrink: 0; min-width: 48px; min-height: 48px; padding: 0; }
.destination { color: var(--ink); font-size: .8125rem; line-height: 1.5; }
</style>
