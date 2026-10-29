<script lang="ts">
  // T-11-577 그로스: Meta 광고 지출 · 설치 · 클릭(에이전트가 매일 08:50 넣는다)과 설치당 비용.
  import type { KpiReport } from '@offside/contracts';
  import { periodSum, valueOn } from '../kpi.ts';
  import { byDim, viewOf } from '../kpi-page.ts';
  import { loader } from '../load.svelte.ts';
  import Load from '../ui/Load.svelte';
  import Stat from '../ui/Stat.svelte';
  import StackedBars from '../ui/StackedBars.svelte';

  let { days, tick }: { days: number; tick: number } = $props();
  const kpi = loader<KpiReport>(() => `/v1/admin/kpi?days=${days}`, () => tick);
  const META_EMPTY = 'Meta 광고 수집(매일 08:50) 뒤 보여요.';
</script>

<div class="page">
  <Load r={kpi.r} height={400}>
    {#snippet children(rep)}
      {@const v = viewOf(rep)}
      {@const sum = (m: string, dims?: string[]) => periodSum(v.days, (d) => valueOn(v.idx, d, m, dims))}
      {@const spend = sum('ad_spend_krw')}
      {@const installs = sum('ad_installs')}
      {@const clicks = sum('ad_clicks')}
      {@const signups = sum('signups', ['all'])}
      <!-- 빠진 날이 있으면 기간 합이 완전하지 않다는 것을 같이 적는다. -->
      {@const gap = (x: { sum: number | null; missing: number }) =>
        x.sum !== null && x.missing ? `${x.missing}일 빠짐` : ''}
      {@const join = (...xs: string[]) => xs.filter(Boolean).join(' · ')}
      {@const per = (a: number | null, b: number | null, what: string) =>
        a && b ? `${what} ${Math.round(a / b).toLocaleString('ko-KR')}원` : ''}
      <div class="stats">
        <Stat
          label={`${days}일 광고 지출`}
          value={spend.sum}
          unit="krw"
          sub={gap(spend)}
          trend={v.days.map((d) => valueOn(v.idx, d, 'ad_spend_krw'))}
        />
        <Stat label="광고 설치" value={installs.sum} sub={join(per(spend.sum, installs.sum, '설치당'), gap(installs))} />
        <Stat label="광고 클릭" value={clicks.sum} sub={join(per(spend.sum, clicks.sum, '클릭당'), gap(clicks))} />
        <Stat
          label="같은 기간 전체 가입"
          value={signups.sum}
          sub={join(per(spend.sum, signups.sum, '광고 지출 ÷ 전체 가입'), gap(signups))}
        />
      </div>
      <div class="cols">
        <StackedBars title="광고 지출 (세트별)" unit="krw" days={v.days} series={byDim(v, 'ad_spend_krw')} empty={META_EMPTY} />
        <StackedBars title="광고 설치 (세트별)" days={v.days} series={byDim(v, 'ad_installs')} empty={META_EMPTY} />
        <StackedBars title="광고 클릭 (세트별)" days={v.days} series={byDim(v, 'ad_clicks')} empty={META_EMPTY} />
        <StackedBars title="스토어 설치" days={v.days} series={byDim(v, 'store_installs')} empty="스토어 수집이 붙으면 보여요." />
      </div>
    {/snippet}
  </Load>
</div>
