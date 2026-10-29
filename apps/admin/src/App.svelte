<script lang="ts">
  // T-11-572 운영 지표 대시보드. GET /v1/admin/kpi(kpi_daily) 한 번으로 그린다. 기간을 바꿀 때만 다시 부른다.
  import { onMount } from 'svelte';
  import type { KpiReport } from '@offside/contracts';
  import { KPI_DAYS } from '@offside/contracts/kpi-rules';
  import { fetchKpi, GAME_URL, type KpiResult } from './api.ts';
  import {
    dimSeries,
    fmt,
    fmtChange,
    indexRows,
    metricSeries,
    nonEmpty,
    periodSum,
    tableOf,
    tile,
    toCsv,
    totalOn,
    valueOn,
    type Series,
  } from './kpi.ts';
  import StackedBars from './StackedBars.svelte';

  const DIM_LABEL: Record<string, string> = {
    all: '전체',
    web: '웹',
    app: '앱',
    toss: '토스',
    ios: 'iOS',
    android: 'Android',
    apple: 'iOS',
    google: 'Android',
    xsolla: '웹 결제',
    linked: '로그인 연결',
  };
  const SOURCE_LABEL: Record<string, string> = {
    d1: '운영 DB',
    ga4: 'GA4',
    admob: 'AdMob',
    meta: 'Meta 광고',
    store: '스토어',
  };
  const REVENUE = ['iap_krw', 'ad_free_krw', 'pass_krw', 'ad_revenue_krw'] as const;

  let days = $state<number>(30);
  let result = $state<KpiResult | null>(null);
  let view = $state<'charts' | 'table'>('charts');
  const cache: Record<number, KpiResult> = {};

  async function load(d: number) {
    days = d;
    const hit = cache[d];
    if (hit?.ok) return void (result = hit);
    result = null;
    const r = await fetchKpi(d);
    if (r.ok) cache[d] = r;
    result = r;
  }
  onMount(() => void load(days));

  const report = $derived(result?.ok ? result.data : null);
  const idx = $derived(report ? indexRows(report) : new Map());
  const list = $derived(report?.days ?? []);
  const dimsOf = (r: KpiReport, metric: string) =>
    [...new Set(r.rows.filter((x) => x.metric === metric).map((x) => x.dim))]
      .sort()
      .map((dim) => ({ dim, label: DIM_LABEL[dim] ?? dim }));

  // 접속자: GA4 DAU가 들어오면 그것을, 아니면 운영 DB 세션 기준.
  const hasDau = $derived(report?.rows.some((r) => r.metric === 'dau') ?? false);
  const activeAt = (d: string) => valueOn(idx, d, hasDau ? 'dau' : 'active');
  const revenueAt = (d: string) => totalOn(idx, d, REVENUE);
  const spendAt = (d: string) => valueOn(idx, d, 'ad_spend_krw');
  const signupAt = (d: string) => valueOn(idx, d, 'signups', ['all']);
  const arpdauAt = (d: string) => {
    const a = activeAt(d);
    const r = revenueAt(d);
    return a && r !== null ? r / a : null;
  };

  const tiles = $derived(
    report
      ? [
          { label: hasDau ? 'DAU (GA4)' : '접속 프로필', t: tile(list, activeAt), unit: 'n' as const, sum: null },
          { label: '신규 가입', t: tile(list, signupAt), unit: 'n' as const, sum: periodSum(list, signupAt) },
          { label: '매출 (정가 추정)', t: tile(list, revenueAt), unit: 'krw' as const, sum: periodSum(list, revenueAt) },
          { label: '광고 지출', t: tile(list, spendAt), unit: 'krw' as const, sum: periodSum(list, spendAt) },
          { label: 'ARPDAU', t: tile(list, arpdauAt), unit: 'krw' as const, sum: null },
        ]
      : [],
  );

  const signupSeries = (): Series[] => {
    const linked = list.map((d) => valueOn(idx, d, 'signups', ['linked']));
    const all = list.map((d) => valueOn(idx, d, 'signups', ['all']));
    return nonEmpty([
      { key: 'linked', label: '로그인 연결', values: linked },
      { key: 'anon', label: '익명', values: all.map((v, i) => (v === null ? null : v - (linked[i] ?? 0))) },
    ]);
  };

  function download() {
    if (!report) return;
    const url = URL.createObjectURL(new Blob([toCsv(report)], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `offside-kpi-${list.at(-1)}-${days}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  const kst = (iso: string) =>
    new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
</script>

<main>
  <header>
    <div>
      <h1>OFFSIDE 운영 지표</h1>
      {#if report}
        <p class="sub">
          {list[0]} ~ {list.at(-1)} (KST) ·
          {#each report.sources as s, i (s.source)}{i ? ' · ' : ''}{SOURCE_LABEL[s.source] ?? s.source} {s.lastDay.slice(5)}까지 ({kst(s.updatedAt)} 수집){/each}
        </p>
      {/if}
    </div>
    <div class="controls">
      <div class="seg" role="group" aria-label="기간">
        {#each KPI_DAYS as d (d)}
          <button class:on={days === d} onclick={() => void load(d)}>{d}일</button>
        {/each}
      </div>
      <div class="seg" role="group" aria-label="보기">
        <button class:on={view === 'charts'} onclick={() => (view = 'charts')}>차트</button>
        <button class:on={view === 'table'} onclick={() => (view = 'table')}>표</button>
      </div>
      <button class="ghost" disabled={!report} onclick={download}>CSV</button>
    </div>
  </header>

  {#if result === null}
    <div class="sk" aria-busy="true"></div>
  {:else if !result.ok}
    <section class="notice">
      {#if result.status === 401}
        <p>로그인 정보가 없어요. <a href={GAME_URL}>오프사이드</a>에서 운영자 구글 계정으로 로그인한 뒤 새로고침해 주세요.</p>
      {:else if result.status === 403}
        <p>운영자 계정이 아니에요.</p>
      {:else}
        <p>지표를 불러오지 못했어요. ({result.message})</p>
        <button class="ghost" onclick={() => void load(days)}>다시 시도</button>
      {/if}
    </section>
  {:else if report && !report.rows.length}
    <section class="notice"><p>아직 수집된 지표가 없어요. 매일 04:00(KST) 일일 작업이 전날까지 채워요.</p></section>
  {:else if report && view === 'table'}
    {@const t = tableOf(report)}
    <div class="table-wrap">
      <table>
        <thead><tr><th>날짜</th>{#each t.cols as c (c)}<th>{c.replace('|', ' · ')}</th>{/each}</tr></thead>
        <tbody>
          {#each t.rows.toReversed() as row (row.day)}
            <tr><th>{row.day}</th>{#each row.cells as v, i (t.cols[i])}<td>{fmt(v)}</td>{/each}</tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else if report}
    <section class="tiles">
      {#each tiles as x (x.label)}
        <article class="tile">
          <h2>{x.label}</h2>
          <p class="big">{fmt(x.t.value, x.unit)}</p>
          <p class="cmp">
            {#if x.t.change !== null}
              <span class:up={x.t.change >= 0} class:down={x.t.change < 0}>{x.t.change >= 0 ? '▲' : '▼'} {fmtChange(x.t.change)}</span>
              지난주 같은 요일 {fmt(x.t.prev, x.unit)}
            {:else}
              어제 · 지난주 비교 없음
            {/if}
          </p>
          {#if x.sum !== null}<p class="cmp">{days}일 합 {fmt(x.sum, x.unit)}</p>{/if}
        </article>
      {/each}
    </section>

    <h2 class="group">사용자</h2>
    <section class="grid">
      {#if hasDau}
        <StackedBars title="DAU (GA4, 플랫폼별)" days={list} series={nonEmpty(dimSeries(idx, list, 'dau', dimsOf(report, 'dau')))} />
      {/if}
      <StackedBars title="접속 프로필 (운영 DB, 채널별)" days={list} series={nonEmpty(dimSeries(idx, list, 'active', dimsOf(report, 'active')))} />
      <StackedBars title="신규 가입" days={list} series={signupSeries()} />
    </section>

    <h2 class="group">수익</h2>
    <section class="grid">
      <StackedBars
        title="매출 (정가 추정)"
        unit="krw"
        days={list}
        series={nonEmpty(metricSeries(idx, list, [
          { metric: 'iap_krw', label: '아이템' },
          { metric: 'ad_free_krw', label: '광고 제거' },
          { metric: 'pass_krw', label: '시즌 패스' },
          { metric: 'ad_revenue_krw', label: '광고 수익' },
        ]))}
      />
      <StackedBars title="아이템 매출 (스토어별)" unit="krw" days={list} series={nonEmpty(dimSeries(idx, list, 'iap_krw', dimsOf(report, 'iap_krw')))} />
      <StackedBars title="구매자 수 (아이템, 스토어별)" days={list} series={nonEmpty(dimSeries(idx, list, 'iap_buyers', dimsOf(report, 'iap_buyers')))} />
      <StackedBars title="멤버십 구독 중 (스토어별)" days={list} series={nonEmpty(dimSeries(idx, list, 'members_active', dimsOf(report, 'members_active')))} />
    </section>

    <h2 class="group">그로스</h2>
    <section class="grid">
      <StackedBars title="광고 지출 (세트별)" unit="krw" days={list} series={nonEmpty(dimSeries(idx, list, 'ad_spend_krw', dimsOf(report, 'ad_spend_krw')))} />
      <StackedBars title="광고 설치 (세트별)" days={list} series={nonEmpty(dimSeries(idx, list, 'ad_installs', dimsOf(report, 'ad_installs')))} />
    </section>

    <h2 class="group">게임</h2>
    <section class="grid">
      <StackedBars title="새 커리어" days={list} series={nonEmpty(metricSeries(idx, list, [{ metric: 'careers_new', label: '새 커리어' }]))} />
      <StackedBars title="은퇴" days={list} series={nonEmpty(metricSeries(idx, list, [{ metric: 'careers_retired', label: '은퇴' }]))} />
      <StackedBars title="게시판 댓글" days={list} series={nonEmpty(metricSeries(idx, list, [{ metric: 'comments', label: '댓글' }]))} />
    </section>
    <p class="foot">매출은 상품별 한국 정가 기준 추정(스토어 환산 · 수수료 전)이에요. 접속 프로필은 수집 시각(04:00)까지 다시 들어온 사람이 빠지는 근사치예요.</p>
  {/if}
</main>

<style>
  main { max-width: 1240px; margin: 0 auto; padding: 24px 16px 48px; }
  header { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: 12px; margin-bottom: 20px; }
  h1 { margin: 0; font-size: 20px; }
  .sub { margin: 4px 0 0; color: var(--text-2); font-size: 12px; }
  .controls { display: flex; flex-wrap: wrap; gap: 8px; }
  .seg { display: inline-flex; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; background: var(--surface); }
  .seg button, .ghost { border: 0; background: transparent; color: var(--text-2); padding: 6px 12px; font: inherit; font-size: 13px; cursor: pointer; }
  .seg button.on { background: var(--text); color: var(--surface); }
  .ghost { border: 1px solid var(--border); border-radius: 8px; background: var(--surface); }
  .ghost:disabled { opacity: 0.5; cursor: default; }
  .tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 8px; }
  .tile { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; }
  .tile h2 { margin: 0; font-size: 12px; font-weight: 500; color: var(--text-2); }
  .big { margin: 4px 0 2px; font-size: 24px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .cmp { margin: 0; font-size: 12px; color: var(--muted); }
  .up { color: var(--good); }
  .down { color: var(--bad); }
  .group { font-size: 15px; margin: 28px 0 10px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 380px), 1fr)); gap: 12px; }
  .notice { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 24px; color: var(--text-2); }
  .notice a { color: var(--s1); }
  .sk { height: 320px; border-radius: 12px; background: var(--surface); border: 1px solid var(--border); }
  .foot { margin-top: 20px; color: var(--muted); font-size: 12px; }
  .table-wrap { overflow: auto; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; max-height: 75vh; }
  table { border-collapse: collapse; font-size: 12px; font-variant-numeric: tabular-nums; }
  th, td { padding: 6px 10px; border-bottom: 1px solid var(--grid); text-align: right; white-space: nowrap; }
  thead th { position: sticky; top: 0; background: var(--surface); color: var(--text-2); font-weight: 500; }
  tbody th { text-align: left; position: sticky; left: 0; background: var(--surface); font-weight: 500; }
</style>
