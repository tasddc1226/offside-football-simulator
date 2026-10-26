<script lang="ts">
  // T-11-379 시즌 경기 리포트 — 기대 득점 대비 실제 · 가장 자주 밀린 줄 · 평균 줄 비교 · 포메이션별 전적.
  import type { TeamStatsReport } from '@offside/app-core/api/team';
  import { seasonReportView } from '@offside/app-core/matchReport';
  import { matchReportText as L } from '@offside/app-core/i18n/ko/matchReport';
  import { signedNum } from '@offside/app-core/teamText';

  let { report }: { report: TeamStatsReport | undefined } = $props();
  const v = $derived(seasonReportView(report));
  const signed = (x: number) => signedNum(Math.round(x * 10) / 10);
</script>

{#if report}
  <div class="stack tm-season-report" style="gap:8px" data-season-report>
    <p class="tm-stats-sub"><b>{L.seasonTitle}</b></p>
    {#if v}
      <p class="fs-sm" style="margin:0" data-season-report-xg>{v.xg}</p>
      <p class="fs-sm" style="margin:0">{v.finish} {v.behind}</p>
      <p class="muted fs-xs" style="margin:0">{L.seasonEdges}</p>
      <dl class="tm-season-pairs">
        {#each v.edges as e (e.label)}
          <div><dt>{e.label}</dt><dd class:neg={e.edge < 0}>{signed(e.edge)}</dd></div>
        {/each}
      </dl>
      {#if v.formations.length}
        <p class="muted fs-xs" style="margin:0">{L.seasonFormations}</p>
        <dl class="tm-season-pairs" data-season-formations>
          {#each v.formations as f (f.formation)}
            <div><dt>{f.formation}</dt><dd>{f.text}</dd></div>
          {/each}
        </dl>
      {/if}
    {:else}
      <p class="muted fs-sm" style="margin:0">{L.seasonEmpty}</p>
    {/if}
  </div>
{/if}

<style>
  .tm-stats-sub {
    margin: 0;
    font-size: var(--fs-body1);
  }
  .tm-season-pairs {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .tm-season-pairs div {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-size: var(--fs-body2);
  }
  .tm-season-pairs dd {
    margin: 0;
    font-weight: 600;
    text-align: right;
  }
  .tm-season-pairs dd.neg {
    color: var(--bad, var(--muted));
  }
</style>
