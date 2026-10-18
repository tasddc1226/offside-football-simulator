<script lang="ts">
  // T-11-379 구간 평점 구성(뛴 경기 평균) — 경기 중계 시트가 다 나온 뒤 지연 청크로 붙인다.
  import type { MatchGame } from '@offside/game/match';
  import { partsText, ratingBreakdown } from '@offside/app-core/ratingReport';
  import { ratingReportText as R } from '@offside/app-core/i18n/ko/ratingReport';

  let { games }: { games: MatchGame[] } = $props();
  const b = $derived(ratingBreakdown(games));
</script>

{#if b}<p class="muted fs-xs rating-parts" data-rating-parts><b>{R.partsTitle}</b> · {partsText(b)}</p>{/if}
