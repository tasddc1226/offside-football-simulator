<script lang="ts">
  // 움직임 없는 컵 그림(받침대 없이) — 닉네임 옆 작은 칭호(TitleBadge)처럼 목록에 여러 개 그려지는 자리.
  import { cupTrophy, TROPHY_CUP_VIEWBOX, type TrophyStage } from '@offside/app-core/cupTrophy';

  const { stage, size }: { stage: TrophyStage; size: number } = $props();
  const trophy = $derived(cupTrophy(stage));
</script>

<svg viewBox={TROPHY_CUP_VIEWBOX} width={size} height={size} aria-hidden="true" focusable="false">
  {#each trophy.layers.filter((layer) => !layer.plinth) as layer, index (index)}
    <path d={layer.d} fill={trophy.palette[layer.tone]} />
  {/each}
</svg>
