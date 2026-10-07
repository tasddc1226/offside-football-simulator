<script lang="ts">
  // 움직임 없는 컵 트로피 그림 — CupTrophy가 효과를 얹고, 닉네임 옆 작은 칭호(TitleBadge)는 이것만 그린다(목록에 여러 개라).
  import { cupTrophy, TROPHY_NUMBER as N, TROPHY_VIEWBOX, type TrophyStage } from '@offside/app-core/cupTrophy';

  const { stage, edition, size }: { stage: TrophyStage; edition: number; size: number } = $props();
  const trophy = $derived(cupTrophy(stage));
</script>

<svg viewBox={TROPHY_VIEWBOX} width={size} height={size} aria-hidden="true" focusable="false">
  {#each trophy.layers as layer, index (index)}
    <path d={layer.d} fill={trophy.palette[layer.tone]} />
  {/each}
  <text x={N.x} y={N.y} font-size={N.size} font-weight="900" text-anchor="middle" fill={trophy.palette.number}>{edition}</text>
</svg>
