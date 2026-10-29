<script lang="ts">
  // T-11-577 개요: 오늘 확인할 일. 데이터 경보 · 실시간 현황(운영 DB) · 기간 매출 · 광고 제거 가격 판단 · 운영 상태.
  // 추세 차트는 사용자 · 수익 · 게임 화면에 두고 여기서는 겹치지 않게 뺀다.
  import type { AdminRevenue, AdminStats, KpiReport } from '@offside/contracts';
  import { dimLabel, fmt, indexRows, kstTime, ratio, valueOn } from '../kpi.ts';
  import { loader } from '../load.svelte.ts';
  import AdFreePrice from '../ui/AdFreePrice.svelte';
  import DataAlerts from '../ui/DataAlerts.svelte';
  import Load from '../ui/Load.svelte';
  import RecentPayments from '../ui/RecentPayments.svelte';
  import Stat from '../ui/Stat.svelte';

  let { days, tick }: { days: number; tick: number } = $props();
  const stats = loader<AdminStats>(() => '/v1/admin/stats', () => tick);
  const rev = loader<AdminRevenue>(() => `/v1/admin/revenue?days=${days}`, () => tick);
  // 가격 판단은 기간 선택과 무관하게 30일로 본다(인상 전 기준 구간이 필요하다).
  const rev30 = loader<AdminRevenue>(() => '/v1/admin/revenue?days=30', () => tick);
  const kpi = loader<KpiReport>(() => '/v1/admin/kpi?days=30', () => tick);
  // 어제 앱 · 웹 오류 횟수(일일 수집 client_errors, 플랫폼별). 상세는 운영 도구의 오류 화면.
  const errors = $derived.by(() => {
    if (!kpi.r?.ok) return null;
    const rep = kpi.r.data;
    const last = rep.days.at(-1);
    const idx = indexRows(rep);
    const total = last ? valueOn(idx, last, 'client_errors') : null;
    if (total === null) return null;
    const parts = rep.rows
      .filter((x) => x.day === last && x.metric === 'client_errors')
      .map((x) => `${dimLabel(x.dim)} ${fmt(x.value)}`)
      .join(' · ');
    return { total, parts };
  });
  const pct = (a: number, b: number) => {
    const r = ratio(a, b);
    return r === null ? '-' : `${Math.round(r * 100)}%`;
  };
</script>

<div class="page">
  {#if kpi.r?.ok}<DataAlerts kpi={kpi.r.data} />{/if}

  <Load r={stats.r} height={128}>
    {#snippet children(s)}
      {@const d = s.daily}
      <div class="stats">
        <Stat label="전체 구단주" value={s.profiles.total} sub={`로그인 연결 ${fmt(s.profiles.linked)} (${pct(s.profiles.linked, s.profiles.total)})`} />
        <Stat label="24시간 접속" value={s.profiles.active24h} sub={`7일 ${fmt(s.profiles.active7d)}`} />
        <Stat
          label="오늘 신규 (진행 중)"
          value={d.at(-1)?.profiles ?? 0}
          sub={`어제 ${fmt(d.at(-2)?.profiles ?? null)} · 7일 ${fmt(s.profiles.new7d)}`}
          trend={d.map((x) => x.profiles)}
        />
        <Stat
          label="오늘 새 커리어 (진행 중)"
          value={d.at(-1)?.careers ?? 0}
          sub={`어제 ${fmt(d.at(-2)?.careers ?? null)} · 진행 중 ${fmt(s.careers.active)}`}
          trend={d.map((x) => x.careers)}
        />
        <Stat
          label="오늘 은퇴 (진행 중)"
          value={d.at(-1)?.retired ?? 0}
          sub={`어제 ${fmt(d.at(-2)?.retired ?? null)} · 7일 ${fmt(s.careers.retired7d)}`}
          trend={d.map((x) => x.retired)}
        />
      </div>
    {/snippet}
  </Load>

  <Load r={rev.r} height={128}>
    {#snippet children(r)}
      <div class="stats">
        <Stat
          label={`${days}일 아이템 + 광고 제거`}
          value={r.total.krw + r.removeAds.krw}
          unit="krw"
          sub="정가 추정 · 환불 반영 · 오늘 포함"
          trend={r.daily.map((x) => x.krw + (x.adKrw ?? 0))}
        />
        <Stat label="아이템" value={r.total.krw} unit="krw" sub={`${fmt(r.total.count)}건 · 구매자 ${fmt(r.total.buyers)}명`} />
        <Stat label="광고 제거" value={r.removeAds.krw} unit="krw" sub={`${fmt(r.removeAds.count)}건 · 환불 ${fmt(r.removeAds.refunds)}`} />
        <Stat label="첫 구매자" value={r.total.firstBuyers} sub={`아이템 환불 ${fmt(r.total.refunds)}건`} />
      </div>
      <p class="note">시즌 패스 · 멤버십 · 광고 수익은 이 합에 없어요. 수익 화면의 일일 수집 지표에서 봐요.</p>
    {/snippet}
  </Load>

  <div class="cols wide">
    <Load r={rev30.r} height={420}>
      {#snippet children(r)}
        <AdFreePrice rev={r} kpi={kpi.r?.ok ? kpi.r.data : null} />
      {/snippet}
    </Load>
    <div class="page">
      <Load r={stats.r} height={240}>
        {#snippet children(s)}
          <section class="panel">
            <header><h2>운영 상태</h2><span class="hint">{kstTime(s.generatedAt)} 기준</span></header>
            <dl class="kv">
              <dt>밸런스 버전</dt>
              <dd>{s.balance ? `v${s.balance.version}` : '기본값'}{#if s.balance?.activatedAt}<small> · {kstTime(s.balance.activatedAt)} 적용</small>{/if}</dd>
              <dt>게시판</dt>
              <dd>글 {fmt(s.board.posts)} · 댓글 {fmt(s.board.comments)}<small> · 7일 댓글 {fmt(s.board.comments7d)}</small></dd>
              {#if errors}
                <dt>어제 앱 · 웹 오류</dt>
                <dd>{fmt(errors.total)}회{#if errors.parts}<small> · {errors.parts}</small>{/if}</dd>
              {/if}
            </dl>
            <h3 class="section-title">최근 운영 기록</h3>
            {#if s.audit.length}
              <ul class="audit">
                {#each s.audit.slice(0, 5) as a, i (`${a.createdAt}-${i}`)}
                  <li><span>{a.kind}</span><time>{kstTime(a.createdAt)}</time></li>
                {/each}
              </ul>
            {:else}
              <p class="note">기록이 없어요.</p>
            {/if}
          </section>
        {/snippet}
      </Load>
      <Load r={rev.r} height={240}>
        {#snippet children(r)}
          <RecentPayments rev={r} limit={6} />
        {/snippet}
      </Load>
    </div>
  </div>
</div>

<style>
  .kv {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 8px 16px;
    margin: 0;
    font-size: 13px;
  }
  dt {
    color: var(--muted);
  }
  dd {
    margin: 0;
    font-variant-numeric: tabular-nums;
  }
  small {
    margin-left: 4px;
    color: var(--muted);
  }
  .audit {
    list-style: none;
    margin: 8px 0 0;
    padding: 0;
    font-size: 13px;
  }
  .audit li {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 0;
    border-bottom: 1px solid var(--grid);
  }
  .audit time {
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
</style>
