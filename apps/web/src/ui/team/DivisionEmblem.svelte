<script lang="ts">
  // T-11-375 디비전 엠블럼(좌표 · 색은 app-core divisionEmblem.ts, 앱과 공용). 장식이라 스크린 리더에는 숨긴다.
  import { DIVISION_INNER, DIVISION_SHIELD, DIVISION_VIEWBOX, divisionEmblem } from '@offside/app-core/divisionEmblem';

  let { division, size = 28 }: { division: number; size?: number } = $props();
  const e = $derived(divisionEmblem(division));
</script>

<svg class="div-emblem" viewBox={DIVISION_VIEWBOX} width={size} height={Math.round((size * 36) / 32)} aria-hidden="true" data-division-emblem={division}>
  <path d={DIVISION_SHIELD} fill={e.rim} />
  <path d={DIVISION_INNER} fill={e.fill} />
  {#each e.chevrons as d (d)}<path {d} fill="none" stroke={e.mark} stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />{/each}
  {#if e.star}<path d={e.star} fill={e.mark} />{/if}
</svg>

<style>
  .div-emblem {
    flex: none;
    display: block;
  }
</style>
