<script lang="ts">
  // 요약 카드: 큰 숫자 하나 + 보조 줄 + (있으면) 추세선.
  import { fmt } from '../kpi.ts';
  import Sparkline from './Sparkline.svelte';

  let {
    label,
    value,
    unit = 'n',
    sub = '',
    trend,
  }: {
    label: string;
    value: number | null;
    unit?: 'n' | 'krw' | 'pct';
    sub?: string;
    trend?: (number | null)[];
  } = $props();
</script>

<article class="stat">
  <h3>{label}</h3>
  <p class="v">{fmt(value, unit)}</p>
  {#if sub}<p class="sub">{sub}</p>{/if}
  {#if trend}<Sparkline values={trend} label={`${label} 추세`} />{/if}
</article>

<style>
  .stat {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 16px 18px 14px;
    min-width: 0;
  }
  h3 {
    margin: 0;
    font-size: 12px;
    font-weight: 500;
    color: var(--text-2);
  }
  .v {
    margin: 6px 0 2px;
    font-size: clamp(20px, 2vw, 26px);
    font-weight: 700;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
  }
  .sub {
    margin: 0;
    font-size: 12px;
    color: var(--muted);
  }
</style>
