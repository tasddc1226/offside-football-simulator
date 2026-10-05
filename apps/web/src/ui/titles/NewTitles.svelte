<script lang="ts">
  // T-10-026 구간 리포트·시즌 결산의 "새 칭호" 줄.
  import type { TitleView } from '@offside/game/titles';
  import TitleTag from './TitleTag.svelte';
  import { titleText as L } from '@offside/app-core/i18n/ko/title';

  const { titles, pop = false }: { titles: TitleView[]; pop?: boolean } = $props();
</script>

{#if titles.length}
  <div data-new-titles>
    <div class="eyebrow" style="margin-bottom:6px">{L.newTitles}</div>
    <div class="chips">
      {#each titles as x, i (x.id)}<TitleTag name={x.name} rarity={x.rarity} {pop} d={i * 90} />{/each}
    </div>
  </div>
{/if}
