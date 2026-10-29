<script lang="ts">
  // T-11-577 사용자: 실시간 구단주 현황 + 일일 수집(접속 · 가입 · GA4) 추세.
  import type { AdminStats, KpiReport } from '@offside/contracts';
  import { fmt, KPI_EMPTY, nonEmpty, ratio, tile, valueOn, fmtChange } from '../kpi.ts';
  import { byDim, viewOf } from '../kpi-page.ts';
  import { loader } from '../load.svelte.ts';
  import Load from '../ui/Load.svelte';
  import Stat from '../ui/Stat.svelte';
  import StackedBars from '../ui/StackedBars.svelte';

  let { days, tick }: { days: number; tick: number } = $props();
  const stats = loader<AdminStats>(() => '/v1/admin/stats', () => tick);
  const kpi = loader<KpiReport>(() => `/v1/admin/kpi?days=${days}`, () => tick);
  const pct = (r: number | null) => (r === null ? '-' : `${Math.round(r * 100)}%`);
</script>

<div class="page">
  <Load r={stats.r} height={128}>
    {#snippet children(s)}
      <div class="stats">
        <Stat label="전체 구단주" value={s.profiles.total} sub={`7일 신규 ${fmt(s.profiles.new7d)}`} trend={s.daily.map((x) => x.profiles)} />
        <Stat label="로그인 연결" value={s.profiles.linked} sub={`전체의 ${pct(ratio(s.profiles.linked, s.profiles.total))}`} />
        <Stat label="24시간 접속" value={s.profiles.active24h} sub={`7일 접속의 ${pct(ratio(s.profiles.active24h, s.profiles.active7d))}`} />
        <Stat label="7일 접속" value={s.profiles.active7d} sub={`전체의 ${pct(ratio(s.profiles.active7d, s.profiles.total))}`} />
      </div>
    {/snippet}
  </Load>

  <h2 class="section-title">일별 추세 (일일 수집, {days}일)</h2>
  <Load r={kpi.r} height={260}>
    {#snippet children(rep)}
      {@const v = viewOf(rep)}
      {@const dau = byDim(v, 'dau')}
      {@const signup = tile(v.days, (d) => valueOn(v.idx, d, 'signups', ['all']))}
      {#if rep.rows.length}
        <div class="stats">
          <Stat label="어제 가입" value={signup.value} sub={signup.change === null ? '지난주 비교 없음' : `지난주 같은 요일 대비 ${fmtChange(signup.change)}`} />
          <Stat label="어제 접속 (운영 DB)" value={tile(v.days, (d) => valueOn(v.idx, d, 'active')).value} />
          {#if dau.length}<Stat label="어제 DAU (GA4)" value={tile(v.days, (d) => valueOn(v.idx, d, 'dau')).value} />{/if}
        </div>
      {/if}
      <div class="cols">
        <StackedBars
          title="신규 가입"
          days={v.days}
          empty={KPI_EMPTY}
          series={(() => {
            const linked = v.days.map((d) => valueOn(v.idx, d, 'signups', ['linked']));
            const all = v.days.map((d) => valueOn(v.idx, d, 'signups', ['all']));
            return nonEmpty([
              { key: 'linked', label: '로그인 연결', values: linked },
              { key: 'anon', label: '익명', values: all.map((x, i) => (x === null ? null : x - (linked[i] ?? 0))) },
            ]);
          })()}
        />
        <StackedBars title="접속 프로필 (운영 DB, 채널별)" days={v.days} series={byDim(v, 'active')} empty={KPI_EMPTY} />
        <StackedBars title="DAU (GA4, 플랫폼별)" days={v.days} series={dau} empty="GA4 수집(매일 08:50) 뒤 보여요." />
        <StackedBars title="GA4 신규 사용자" days={v.days} series={byDim(v, 'new_users')} empty="GA4 수집(매일 08:50) 뒤 보여요." />
      </div>
    {/snippet}
  </Load>
</div>
