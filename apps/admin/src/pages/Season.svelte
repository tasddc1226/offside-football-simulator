<script lang="ts">
  // T-11-577 시즌 운영: 오프사이드 리그 현재 시즌 · 컵 일정 · 시즌 패스 판매(일일 수집). 리그가 없으면(404) 그렇게 적는다.
  import type { AdminCupList, AdminLeague, KpiReport } from '@offside/contracts';
  import { fmt, KPI_EMPTY, kstTime, metricSeries, nonEmpty, periodSum, valueOn } from '../kpi.ts';
  import { viewOf } from '../kpi-page.ts';
  import { loader } from '../load.svelte.ts';
  import Load from '../ui/Load.svelte';
  import Stat from '../ui/Stat.svelte';
  import StackedBars from '../ui/StackedBars.svelte';

  let { days, tick }: { days: number; tick: number } = $props();
  const league = loader<AdminLeague>(() => '/v1/admin/leagues/current', () => tick);
  const cups = loader<AdminCupList>(() => '/v1/admin/cups', () => tick);
  const kpi = loader<KpiReport>(() => `/v1/admin/kpi?days=${days}`, () => tick);

  const PHASE: Record<AdminLeague['phase'], string> = {
    soon: '접수 전',
    open: '접수 중',
    closed: '접수 마감 · 배치 대기',
    running: '진행 중',
    done: '끝남',
  };
  const CUP: Record<AdminCupList['items'][number]['status'], string> = {
    scheduled: '예정',
    entry: '접수 중',
    running: '진행 중',
    done: '끝남',
  };
  const DIVISION: Record<string, string> = { junior: '주니어', senior: '시니어', master: '마스터' };
</script>

<div class="page">
  {#if league.r && !league.r.ok && league.r.status === 404}
    <section class="panel"><p class="note">지금 열린 오프사이드 리그 시즌이 없어요.</p></section>
  {:else}
    <Load r={league.r} height={128}>
      {#snippet children(l)}
        <div class="stats">
          <Stat label="신청 팀" value={l.counts.entries} sub={`배치 ${fmt(l.counts.placed)} · 빠짐 ${fmt(l.counts.dropped)}`} />
          <Stat label="치른 라운드" value={l.playedRounds} sub={`전체 ${l.league.rounds.length}라운드 · 기권 ${fmt(l.counts.forfeited)}`} />
          <Stat label="밀린 경기" value={l.overdue} sub={l.overdue ? '시각이 지났는데 안 치른 경기(cron 확인)' : '밀린 경기 없음'} />
        </div>
        <section class="panel">
          <header>
            <h2>리그 시즌 {l.league.season} 일정 (KST)</h2>
            <span class={`chip ${l.phase === 'running' || l.phase === 'open' ? 'good' : ''}`}>{PHASE[l.phase]}{l.delayed ? ' · 일정 미룸' : ''}</span>
          </header>
          <dl class="kv">
            <dt>개막</dt><dd>{kstTime(l.league.startsAt)}</dd>
            <dt>접수</dt><dd>{kstTime(l.league.opensAt)} ~ {kstTime(l.league.closesAt)}</dd>
            <dt>배치</dt><dd>{kstTime(l.league.drawAt)}{l.drawnAt ? ' · 배치 끝' : ''}</dd>
            <dt>라운드</dt><dd>{l.league.rounds.length ? `${kstTime(l.league.rounds[0]!)} ~ ${kstTime(l.league.rounds.at(-1)!)}` : '—'}</dd>
          </dl>
        </section>
      {/snippet}
    </Load>
  {/if}

  <div class="cols">
    <Load r={kpi.r} height={260}>
      {#snippet children(rep)}
        {@const v = viewOf(rep)}
        {@const n = periodSum(v.days, (d) => valueOn(v.idx, d, 'pass_count'))}
        <StackedBars
          title={`시즌 패스 판매 건수 (${days}일${n.sum === null ? '' : ` · 합 ${fmt(n.sum)}건`})`}
          days={v.days}
          series={nonEmpty(metricSeries(v.idx, v.days, [{ metric: 'pass_count', label: '시즌 패스' }]))}
          empty={KPI_EMPTY}
        />
      {/snippet}
    </Load>
    <Load r={cups.r} height={260}>
      {#snippet children(c)}
        <section class="panel">
          <header><h2>컵 대회</h2><span class="hint">최근 순</span></header>
          {#if c.items.length}
            <div class="tbl-wrap">
              <table class="tbl">
                <thead><tr><th>회차</th><th>구간</th><th>상태</th><th class="num">신청</th><th>접수 마감</th></tr></thead>
                <tbody>
                  {#each c.items.slice(0, 8) as x (x.cup.id)}
                    <tr>
                      <td>시즌 {x.cup.season} · {x.cup.edition}회</td>
                      <td>{x.cup.division ? (DIVISION[x.cup.division] ?? x.cup.division) : '—'}</td>
                      <td><span class={`chip ${x.status === 'running' || x.status === 'entry' ? 'good' : ''}`}>{CUP[x.status]}</span></td>
                      <td class="num">{fmt(x.entries)} / {fmt(x.cup.capacity)}</td>
                      <td>{kstTime(x.cup.closesAt)}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {:else}
            <p class="note">컵 일정이 없어요.</p>
          {/if}
        </section>
      {/snippet}
    </Load>
  </div>
</div>

<style>
  .kv {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 8px 16px;
    margin: 0;
    font-size: 13px;
    font-variant-numeric: tabular-nums;
  }
  dt {
    color: var(--muted);
  }
  dd {
    margin: 0;
  }
</style>
