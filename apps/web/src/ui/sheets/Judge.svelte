<script lang="ts">
  import type { SheetView } from '@offside/app-core/sheets';
  import { sheetCoreText } from '@offside/app-core/i18n/ko/sheetCore';
  let { v }: { v: Extract<SheetView, { kind: 'judge' }> } = $props();
  const pct = $derived(Math.round(v.p * 100));
</script>

<div class="eyebrow">{sheetCoreText.judging}</div>
<h2>{v.label}</h2>
<div class="judge">
  <div class="ok" style="width:{v.p * 100}%"></div>
  <div class="ng"></div>
  <i class="needle" style="left:calc({v.pos * 100}% - 1px)"></i>
</div>
<div class="judge-lbl"><span>{sheetCoreText.judgeOk({ pct })}</span><span>{sheetCoreText.judgeFail({ pct: 100 - pct })}</span></div>
