<script lang="ts">
  import type { SheetView } from './types.js';
  let { v }: { v: Extract<SheetView, { kind: 'steps' }> } = $props();
</script>

<div class="eyebrow">{v.title}</div>
<div class="prog"><i style="width:{v.progress * 100}%"></i></div>
<div class="steps">
  {#each v.steps as t, i (i)}
    <div class:on={i === v.active} class:done={i < v.active}>{t}</div>
  {/each}
</div>
