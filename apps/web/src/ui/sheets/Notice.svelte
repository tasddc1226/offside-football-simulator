<script lang="ts">
  import type { SheetView } from './types.js';
  let { v }: { v: Extract<SheetView, { kind: 'notice' }> } = $props();
</script>

<div class="eyebrow">{v.eyebrow}</div>
{#if v.title}<h2>{v.title}</h2>{/if}
{#if v.big}<div class="result-big {v.big.ok ? 'ok' : 'ng'}">{v.big.text}</div>{/if}
{#if v.text}<p class:muted={v.muted}>{v.text}</p>{/if}
