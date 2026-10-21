<script lang="ts">
  // T-11-442 상점(리롤권 · 프리미엄 스카우트권)에서 구단 자금이 모자랄 때 — 얼마나 모자라는지와, 자금을 만드는 이적시장 방출
  // 화면으로 가는 링크(앱 owner/FundsShort.tsx).
  import { cupText as L } from '@offside/app-core/i18n/ko/cup';
  import { goMarketRelease } from '../nav.js';

  let { text }: { text: string | null } = $props();
</script>

{#if text}
  <div class="fs-short" data-funds-short>
    <p class="muted fs-sm">{text}</p>
    <button class="btn btn-sm self-start" data-act="funds-go-release" onclick={goMarketRelease}>{L.shopGoRelease}</button>
  </div>
{/if}

<style>
  .fs-short {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .fs-short p {
    margin: 0;
  }
</style>
