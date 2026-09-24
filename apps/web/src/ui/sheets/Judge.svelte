<script lang="ts">
  import type { SheetView } from './types.js';
  let { v }: { v: Extract<SheetView, { kind: 'judge' }> } = $props();
  const pct = $derived(Math.round(v.p * 100));
</script>

<div class="eyebrow">판정 중</div>
<h2>{v.label}</h2>
<div class="judge">
  <div class="ok" style="width:{v.p * 100}%"></div>
  <div class="ng"></div>
  <i class="needle" style="left:calc({v.pos * 100}% - 1px)"></i>
</div>
<div class="judge-lbl"><span>성공 {pct}%</span><span>실패 {100 - pct}%</span></div>
