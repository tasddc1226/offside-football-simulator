<script lang="ts">
  import { pickOption } from '../actions.js';
  import type { SheetView } from './types.js';
  import ClubBadge from '../ClubBadge.svelte';
  let { v }: { v: Extract<SheetView, { kind: 'market' }> } = $props();
</script>

<div class="eyebrow">{v.eyebrow}</div>
<h2>다음 시즌, 어디서 뛸까요?</h2>
<p class="muted">{v.note}</p>
<div class="stack">
  {#each v.options as o, i (i)}
    <button class="offer" data-opt={i} onclick={() => pickOption(i)}>
      <div class="offer-club">{#if o.clubId}<ClubBadge club={{ id: o.clubId, name: o.name }} size={30} />{/if}<div><b>{o.name}</b><div class="lg">{o.lg}</div></div></div>
      {#if o.salary !== null}
        <div class="sal">{o.salary}<div class="lg" style="text-align:right">연봉</div></div>
        <div class="sub">{o.sub}</div>
      {/if}
    </button>
  {/each}
</div>
