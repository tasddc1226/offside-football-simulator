<script lang="ts">
  // 개요 맨 위 경보 줄: 매일 들어와야 하는 원천(운영 DB · GA4 · Meta)이 어제 행까지 없으면 알린다. 문제가 없으면 아무것도 그리지 않는다.
  import type { KpiReport } from '@offside/contracts';
  import { sourceLag } from '../kpi.ts';

  let { kpi }: { kpi: KpiReport } = $props();
  const DAILY = [
    { source: 'd1', label: '운영 DB(04:00)' },
    { source: 'ga4', label: 'GA4(08:50)' },
    { source: 'meta', label: 'Meta 광고(08:50)' },
  ] as const;
  const issues = $derived(
    DAILY.flatMap(({ source, label }) => {
      const lag = sourceLag(kpi.sources.find((s) => s.source === source)?.lastDay, kpi.days.at(-1));
      if (lag === null) return [`${label} 수집 기록 없음`];
      return lag > 0 ? [`${label} ${lag}일 밀림`] : [];
    }),
  );
</script>

{#if issues.length}
  <a class="alert" href="#/data">
    <strong>데이터 확인</strong>
    <span>{issues.join(' · ')}</span>
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
