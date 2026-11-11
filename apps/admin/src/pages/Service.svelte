<script lang="ts">
  // T-11-693 서비스 상태: API 요청 · 오류 · 느린 요청, DB 크기, 앱 · 웹 오류, OTA 게시. 모두 일일 수집(kpi_daily)에서 읽는다.
  import type { KpiReport } from '@offside/contracts';
  import { fmt, KPI_EMPTY, ratio } from '../kpi.ts';
  import { byDim, lastValue, periodTotal, trendOf, viewOf, type KpiView } from '../kpi-page.ts';
  import { loader } from '../load.svelte.ts';
  import Load from '../ui/Load.svelte';
  import Stat from '../ui/Stat.svelte';
  import StackedBars from '../ui/StackedBars.svelte';

  let { days, tick }: { days: number; tick: number } = $props();
  const kpi = loader<KpiReport>(() => `/v1/admin/kpi?days=${days}`, () => tick);
  const one = (v: KpiView, metric: string, label: string) => {
    const values = trendOf(v, metric);
    return values.some((x) => x !== null) ? [{ key: metric, label, values }] : [];
  };
  const rate = (v: KpiView, metric: string) => {
    const a = periodTotal(v, metric);
    const b = periodTotal(v, 'api_requests');
    return a === null || b === null ? null : ratio(a, b);
  };
  const size = (v: KpiView, dim: string) => lastValue(v, 'db_size_mb', [dim]);
  const gb = (mb: number | undefined) => (mb === undefined ? '—' : `${(mb / 1024).toFixed(2)}GB`);
</script>

<div class="page">
  <Load r={kpi.r} height={420}>
    {#snippet children(rep)}
      {@const v = viewOf(rep)}
      {@const game = size(v, 'game')}
      {@const ops = size(v, 'ops')}
      <div class="stats">
        <Stat label={`${days}일 API 요청`} value={periodTotal(v, 'api_requests')} sub="서버가 센 근삿값" trend={trendOf(v, 'api_requests')} />
        <Stat label="오류 비율 (5xx)" value={rate(v, 'api_errors')} unit="pct" sub={`오류 ${fmt(periodTotal(v, 'api_errors'))}건`} trend={trendOf(v, 'api_errors')} />
        <Stat label="느린 요청 비율" value={rate(v, 'api_slow')} unit="pct" sub="1초 넘게 걸린 요청" trend={trendOf(v, 'api_slow')} />
        <Stat label="게임 DB 크기 (GB)" value={game ? Math.round(game.value / 10.24) / 100 : null} sub={`운영 기록 DB ${gb(ops?.value)}${game ? ` · ${game.day}` : ''}`} />
      </div>
      <div class="cols">
        <StackedBars title={`하루 API 오류 (${days}일)`} days={v.days} series={one(v, 'api_errors', '5xx 오류')} empty={KPI_EMPTY} />
        <StackedBars title={`하루 느린 요청 (${days}일)`} days={v.days} series={one(v, 'api_slow', '1초 넘은 요청')} empty={KPI_EMPTY} />
        <StackedBars title={`평균 응답 시간 ms (${days}일)`} days={v.days} series={one(v, 'api_avg_ms', '평균 ms')} empty={KPI_EMPTY} />
        <StackedBars title={`앱 · 웹 오류 (${days}일)`} days={v.days} series={byDim(v, 'client_errors')} empty={KPI_EMPTY} />
        <StackedBars title={`운영 채널 OTA 게시 (${days}일)`} days={v.days} series={byDim(v, 'ota_published')} empty="매일 08:50(KST)에 전날 게시 수를 받아요." />
      </div>
      <p class="note">API 수치는 서버 상태 화면(/v1/status)과 같은 원본을 하루로 더한 값이에요. 요청 수는 Cloudflare 집계보다 조금 적게 나와요.</p>
    {/snippet}
  </Load>
</div>
