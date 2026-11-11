<script lang="ts">
  // 개요 맨 위 경보 줄: 매일 들어와야 하는 지표가 늦으면 알린다(T-11-693 원천 단위 → 지표 단위. 한 원천 안에서 지표 하나만 끊겨도 잡는다).
  // 문제가 없으면 아무것도 그리지 않는다.
  import type { KpiReport } from '@offside/contracts';
  import { laggingMetrics, viewOf } from '../kpi-page.ts';

  let { kpi }: { kpi: KpiReport } = $props();
  const issues = $derived(
    laggingMetrics(viewOf(kpi)).map((x) =>
      x.lag === null ? `${x.label} 기록 없음` : `${x.label} ${x.lag}일 밀림`,
    ),
  );
  const SHOW = 4;
</script>

{#if issues.length}
  <a class="alert" href="#/data">
    <strong>데이터 확인</strong>
    <span>{issues.slice(0, SHOW).join(' · ')}{issues.length > SHOW ? ` 외 ${issues.length - SHOW}개` : ''}</span>
    <span class="go">데이터 화면 →</span>
  </a>
{/if}

<style>
  .alert {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 12px;
    align-items: center;
    padding: 10px 14px;
    border-radius: 10px;
    border: 1px solid color-mix(in srgb, var(--warn) 45%, var(--border));
    background: color-mix(in srgb, var(--warn) 10%, var(--surface));
    color: var(--text);
    font-size: 13px;
    text-decoration: none;
  }
  strong {
    color: var(--warn);
  }
  .go {
    margin-left: auto;
    color: var(--text-2);
  }
</style>
