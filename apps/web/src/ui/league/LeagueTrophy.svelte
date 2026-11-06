<script lang="ts">
  // T-11-640 리그 우승 트로피(모양 · 색은 app-core leagueArt.ts, 앱과 공용). 받침대에 name을 새기고, 움직임은 넣지 않는다.
  import { LEAGUE_ART_VIEWBOX, LEAGUE_TROPHY_PLATE as P, leagueTrophy } from '@offside/app-core/leagueArt';

  let { tier, league, name, size = 60 }: { tier: number; league: number; name?: string | undefined; size?: number } = $props();
  const art = $derived(leagueTrophy(tier, league));
  const pct = (n: number) => `${(n / 64) * 100}%`;
</script>

<span class="league-trophy" style:width="{size}px" style:height="{size}px" aria-hidden="true" data-league-trophy={`${tier}-${league}`}>
  <svg viewBox={LEAGUE_ART_VIEWBOX} width={size} height={size} focusable="false">
    {#each art.layers as layer, i (i)}<path d={layer.d} fill={art.palette[layer.tone]} />{/each}
  </svg>
  {#if name}
    <span class="plate" style:left={pct(P.x)} style:top={pct(P.y)} style:width={pct(P.w)} style:height={pct(P.h)} style:font-size="{(size * P.font) / 64}px" style:color={art.palette.engrave}>{name}</span>
  {/if}
</span>

<style>
  .league-trophy {
    position: relative;
    flex: none;
    display: block;
  }
  .league-trophy svg {
    display: block;
  }
  .plate {
    position: absolute;
    overflow: hidden;
    text-align: center;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 800;
    line-height: 1.4;
  }
</style>
