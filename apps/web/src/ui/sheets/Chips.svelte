<script lang="ts">
  import { fmtMoney } from '@offside/game/engine';
  import type { Chip } from '../sheetState.svelte.js';

  // split(T-11-200 구간 리포트): 오른 것과 내린 것을 한 줄씩 나눠 그린다.
  let { chips, pop = false, split = false }: { chips: Chip[]; pop?: boolean; split?: boolean } = $props();
  const val = (c: Chip) => c.text || (c.money ? (c.d > 0 ? '+' : '') + fmtMoney(c.d) : (c.d > 0 ? '+' : '') + c.d);
  const down = (c: Chip) => c.bad || c.d < 0;
  const rows = $derived(split ? [chips.filter((c) => !down(c)), chips.filter(down)].filter((r) => r.length) : [chips]);
</script>

{#if chips.length}
  {#each rows as row, ri (ri)}
    <div class="chips">
      {#each row as c, i (i)}
        <span class="chip {down(c) ? 'down' : 'up'}" class:pop style="--d:{(ri ? rows[0]!.length : 0) * 70 + i * 70}ms">{c.label} {val(c)}</span>
      {/each}
    </div>
  {/each}
{/if}
