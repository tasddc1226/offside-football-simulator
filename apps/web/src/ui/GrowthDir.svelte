<script lang="ts">
  // T-11-379 성장 방향 한 줄 — 능력치 카드 · 시즌 결산에 지연 청크로 붙인다.
  import { growthDirectionText, type GrowthDirInfo } from '@offside/app-core/ratingReport';
  import { ratingReportText as R } from '@offside/app-core/i18n/ko/ratingReport';

  let { info, cls = 'stat-note', title = true }: { info: GrowthDirInfo; cls?: string; title?: boolean } = $props();
</script>

<p class={cls} data-growth-dir>{#if title}<b>{R.dirTitle}</b> · {/if}{growthDirectionText(info.d, info.attr)}</p>
