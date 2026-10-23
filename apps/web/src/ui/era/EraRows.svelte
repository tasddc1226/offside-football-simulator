<script lang="ts">
  // T-11-475 나 · 라이벌 비교 표(결산 카드 · 트로피 탭).
  import type { EraRow } from '@offside/app-core/era-view';
  import { eraText as L } from '@offside/app-core/i18n/ko/era';
  let { rows }: { rows: readonly EraRow[] } = $props();
</script>

<div class="era-rows" role="table">
  <div class="era-row era-head" role="row">
    <span role="columnheader"></span><span role="columnheader">{L.me}</span><span role="columnheader">{L.rival}</span>
  </div>
  {#each rows as r (r.label)}
    <div class="era-row" role="row">
      <span class="muted" role="rowheader">{r.label}</span>
      <b class="num" class:win={r.win > 0} role="cell">{r.me}</b>
      <b class="num" class:win={r.win < 0} role="cell">{r.rival}</b>
    </div>
  {/each}
</div>

<style>
  .era-rows { display: grid; gap: 2px; margin: 8px 0; }
  .era-row { display: grid; grid-template-columns: 1fr 72px 72px; align-items: center; gap: 8px; padding: 5px 0; border-top: 1px solid var(--line); font-size: var(--fs-body2); }
  .era-head { border-top: 0; font-size: var(--fs-caption); color: var(--muted); }
  .era-head span, .era-row b { text-align: right; }
  .era-row b { font-size: var(--fs-body2); font-weight: 600; color: var(--muted); }
  .era-row b.win { color: var(--accent-text); font-weight: 800; }
</style>
