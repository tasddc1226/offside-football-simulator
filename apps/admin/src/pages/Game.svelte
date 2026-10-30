<script lang="ts">
  // T-11-577 게임 · 커뮤니티: 커리어 · 게시판 실시간 현황 + 일일 수집 추세.
  import type { AdminStats, KpiReport } from '@offside/contracts';
  import { fmt, KPI_EMPTY, metricSeries, nonEmpty, ratio } from '../kpi.ts';
  import { viewOf } from '../kpi-page.ts';
  import { loader } from '../load.svelte.ts';
  import Load from '../ui/Load.svelte';
  import Stat from '../ui/Stat.svelte';
  import StackedBars from '../ui/StackedBars.svelte';

  let { days, tick }: { days: number; tick: number } = $props();
  const stats = loader<AdminStats>(() => '/v1/admin/stats', () => tick);
  const kpi = loader<KpiReport>(() => `/v1/admin/kpi?days=${days}`, () => tick);
  const one = (v: ReturnType<typeof viewOf>, metric: string, label: string) =>
    nonEmpty(metricSeries(v.idx, v.days, [{ metric, label }]));
</script>

<div class="page">
  <Load r={stats.r} height={128}>
    {#snippet children(s)}
      {@const per = ratio(s.careers.total, s.profiles.total)}
      <div class="stats">
        <Stat label="진행 중 커리어" value={s.careers.active} sub={`누적 ${fmt(s.careers.total)}`} trend={s.daily.map((x) => x.careers)} />
        <Stat label="7일 새 커리어" value={s.careers.new7d} sub={per === null ? '' : `누적 커리어 ÷ 전체 구단주 ${per.toFixed(1)}`} />
        <Stat label="7일 은퇴" value={s.careers.retired7d} sub={`누적 은퇴 ${fmt(s.careers.retired)}`} trend={s.daily.map((x) => x.retired)} />
        <Stat label="게시판 글" value={s.board.posts} sub={`댓글 ${fmt(s.board.comments)}`} />
        <Stat label="7일 댓글" value={s.board.comments7d} />
      </div>
    {/snippet}
  </Load>

  <div class="cols">
    <Load r={stats.r} height={260}>
      {#snippet children(s)}
        <StackedBars title="최근 14일 은퇴" days={s.daily.map((x) => x.day)} series={[{ key: 'retired', label: '은퇴', values: s.daily.map((x) => x.retired) }]} />
      {/snippet}
    </Load>
    <Load r={kpi.r} height={260}>
      {#snippet children(rep)}
        {@const v = viewOf(rep)}
        <StackedBars title={`새 커리어 (${days}일)`} days={v.days} series={one(v, 'careers_new', '새 커리어')} empty={KPI_EMPTY} />
      {/snippet}
    </Load>
    <Load r={kpi.r} height={260}>
      {#snippet children(rep)}
        {@const v = viewOf(rep)}
        <StackedBars title={`은퇴 (${days}일)`} days={v.days} series={one(v, 'careers_retired', '은퇴')} empty={KPI_EMPTY} />
      {/snippet}
    </Load>
    <Load r={kpi.r} height={260}>
      {#snippet children(rep)}
        {@const v = viewOf(rep)}
        <StackedBars title={`게시판 댓글 (${days}일)`} days={v.days} series={one(v, 'comments', '댓글')} empty={KPI_EMPTY} />
      {/snippet}
    </Load>
  </div>
</div>
