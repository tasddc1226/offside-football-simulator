<script lang="ts">
  import { fmtMoney } from '../../game/engine.js';
  import type { Chip } from '../sheetState.svelte.js';

  let { chips, pop = false }: { chips: Chip[]; pop?: boolean } = $props();
  const val = (c: Chip) => c.text || (c.money ? (c.d > 0 ? '+' : '') + fmtMoney(c.d) : (c.d > 0 ? '+' : '') + c.d);
</script>

{#if chips.length}
  <div class="chips">
    {#each chips as c, i (i)}
      <span class="chip {c.bad || c.d < 0 ? 'down' : 'up'}" class:pop style="--d:{i * 70}ms">{c.label} {val(c)}</span>
    {/each}
  </div>
{/if}
