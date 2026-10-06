<script lang="ts">
  import { pickOption } from '../actions.js';
  import type { SheetView } from '@offside/app-core/sheets';
  import ClubBadge from '../ClubBadge.svelte';
  import { sheetPlayText as L } from '@offside/app-core/i18n/ko/sheetPlay';
  let { v }: { v: Extract<SheetView, { kind: 'market' }> } = $props();
</script>

<div class="eyebrow">{v.eyebrow}</div>
<h2>{L.marketTitle}</h2>
<p class="muted">{v.note}</p>
{#if v.assessment}<p class="fs-sm" data-market-feedback>{v.assessment}</p>{/if}
<div class="stack">
  {#each v.options as o, i (i)}
    <button class="offer" data-opt={i} onclick={() => pickOption(i)}>
      <div class="offer-club">{#if o.clubId}<ClubBadge club={{ id: o.clubId, name: o.name }} size={30} />{/if}<div><b>{o.name}</b><div class="lg">{o.lg}</div></div></div>
      {#if o.salary !== null}
        <div class="sal">{o.salary}<div class="lg" style="text-align:right">{L.salary}</div></div>
      {/if}
      {#if o.sub}<div class="sub">{o.sub}</div>{/if}
      {#if o.reason}<div class="sub" data-offer-feedback>{o.reason}</div>{/if}
    </button>
  {/each}
</div>
