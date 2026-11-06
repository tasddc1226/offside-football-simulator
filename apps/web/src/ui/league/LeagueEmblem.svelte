<script lang="ts">
  // T-11-640 리그 아이콘(모양 · 색은 app-core leagueArt.ts, 앱과 공용). 이름이 옆에 있는 장식이라 스크린 리더에는 숨긴다.
  import { LEAGUE_ART_VIEWBOX, leagueEmblem } from '@offside/app-core/leagueArt';

  let { tier, league, size = 28 }: { tier: number; league: number; size?: number } = $props();
  const art = $derived(leagueEmblem(tier, league));
</script>

<svg class="league-emblem" viewBox={LEAGUE_ART_VIEWBOX} width={size} height={size} aria-hidden="true" focusable="false" data-league-emblem={`${tier}-${league}`}>
  {#each art.layers as layer, i (i)}<path d={layer.d} fill={art.palette[layer.tone]} />{/each}
</svg>

<style>
  .league-emblem {
    flex: none;
    display: block;
  }
</style>
