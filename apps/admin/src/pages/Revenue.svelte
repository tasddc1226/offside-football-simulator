<script lang="ts">
  // T-11-577 수익: 서버 원장(아이템) · 스토어 알림(광고 제거) 실시간 합 + 일일 수집(시즌 패스 · 멤버십 · 광고 수익).
  import type { AdminRevenue, KpiReport } from '@offside/contracts';
  import { dimLabel, fmt, KPI_EMPTY, metricSeries, nonEmpty, periodSum, productLabel, valueOn } from '../kpi.ts';
  import { byDim, viewOf } from '../kpi-page.ts';
  import { loader } from '../load.svelte.ts';
  import AdFreePrice from '../ui/AdFreePrice.svelte';
  import HBars from '../ui/HBars.svelte';
  import Load from '../ui/Load.svelte';
  import RecentPayments from '../ui/RecentPayments.svelte';
  import Stat from '../ui/Stat.svelte';
  import StackedBars from '../ui/StackedBars.svelte';

  let { days, tick }: { days: number; tick: number } = $props();
  const rev = loader<AdminRevenue>(() => `/v1/admin/revenue?days=${days}`, () => tick);
  const kpi = loader<KpiReport>(() => `/v1/admin/kpi?days=${days}`, () => tick);
  const rev30 = loader<AdminRevenue>(() => '/v1/admin/revenue?days=30', () => tick);
  const avg = (krw: number, n: number) => (n ? `객단가 ${fmt(krw / n, 'krw')}` : '');
  const MEMBER_EMPTY = '멤버십 흐름은 다음 일일 수집(04:00)부터 보여요.';
</script>

<div class="page">
  <Load r={rev.r} height={128}>
    {#snippet children(r)}
      <div class="stats">
        <Stat label={`${days}일 아이템 + 광고 제거`} value={r.total.krw + r.removeAds.krw} unit="krw" trend={r.daily.map((x) => x.krw + (x.adKrw ?? 0))} />
        <Stat label="아이템 매출" value={r.total.krw} unit="krw" sub={`${fmt(r.total.count)}건 · ${avg(r.total.krw, r.total.buyers)}`} />
        <Stat label="구매자" value={r.total.buyers} sub={`첫 구매 ${fmt(r.total.firstBuyers)}명`} />
        <Stat label="광고 제거 (환불 반영)" value={r.removeAds.krw} unit="krw" sub={`${fmt(r.removeAds.count)}건 · 환불 ${fmt(r.removeAds.refunds)}`} />
        <Stat label="환불 (아이템)" value={r.total.refundKrw} unit="krw" sub={`${fmt(r.total.refunds)}건`} />
        <Stat
          label="누적 매출"
          value={r.allTime.krw + (r.removeAds.allTime?.krw ?? 0)}
          unit="krw"
          sub={`아이템 구매자 ${fmt(r.allTime.buyers)}명 · 광고 제거 ${fmt(r.removeAds.allTime?.count ?? null)}건`}
        />
      </div>
    {/snippet}
  </Load>

  <Load r={kpi.r} height={0}>
    {#snippet children(k)}
      <Load r={rev30.r} height={420}>
        {#snippet children(r)}
          <AdFreePrice rev={r} kpi={k} />
        {/snippet}
      </Load>
    {/snippet}
  </Load>

  <div class="cols wide">
    <Load r={rev.r} height={260}>
      {#snippet children(r)}
        <StackedBars
          title="일별 매출 (아이템 · 광고 제거)"
          unit="krw"
          days={r.daily.map((x) => x.day)}
          series={nonEmpty([
            { key: 'iap', label: '아이템', values: r.daily.map((x) => x.krw) },
            { key: 'ads', label: '광고 제거 (환불 전)', values: r.daily.map((x) => x.adKrw ?? 0) },
          ])}
          empty="기간 안 매출이 없어요."
        />
      {/snippet}
    </Load>
    <Load r={rev.r} height={260}>
      {#snippet children(r)}
        <section class="panel">
          <header><h2>스토어별</h2><span class="hint">건수</span></header>
          <HBars
            items={[
              ...r.stores.map((s) => ({ key: `iap-${s.store}`, label: `아이템 · ${dimLabel(s.store)}`, value: s.count, note: fmt(s.krw, 'krw') })),
              ...(r.removeAds.stores ?? []).map((s) => ({
                key: `ads-${s.store}`,
                label: `광고 제거 · ${dimLabel(s.store)}`,
                value: s.count,
                note: s.refunds ? `환불 ${s.refunds}` : undefined,
              })),
            ].sort((a, b) => b.value - a.value)}
          />
        </section>
      {/snippet}
    </Load>
  </div>

  <div class="cols wide">
    <Load r={rev.r} height={300}>
      {#snippet children(r)}
        <RecentPayments rev={r} />
      {/snippet}
    </Load>
    <Load r={rev.r} height={300}>
      {#snippet children(r)}
        <section class="panel">
          <header><h2>상품별 매출</h2><span class="hint">{days}일</span></header>
          <HBars
            unit="krw"
            items={r.products
              .toSorted((a, b) => b.krw - a.krw)
              .map((p) => ({
                key: p.productId,
                label: productLabel(p.productId),
                value: p.krw,
                note: `${p.count}건${p.refunded ? ` · 환불 ${p.refunded}` : ''}`,
              }))}
          />
        </section>
      {/snippet}
    </Load>
  </div>

  <h2 class="section-title">일일 수집 지표 ({days}일)</h2>
  <Load r={kpi.r} height={260}>
    {#snippet children(rep)}
      {@const v = viewOf(rep)}
      <div class="cols">
        <StackedBars
          title="스토어 매출 구성 (정가 추정)"
          unit="krw"
          days={v.days}
          empty={KPI_EMPTY}
          series={nonEmpty(
            metricSeries(v.idx, v.days, [
              { metric: 'iap_krw', label: '아이템' },
              { metric: 'ad_free_krw', label: '광고 제거' },
              { metric: 'pass_krw', label: '시즌 패스' },
            ]),
          )}
        />
        <StackedBars title="아이템 구매자 (스토어별)" days={v.days} series={byDim(v, 'iap_buyers')} empty={KPI_EMPTY} />
        <StackedBars title="광고 수익 (AdMob)" unit="krw" days={v.days} series={byDim(v, 'ad_revenue_krw')} empty="AdMob 수집이 붙으면 보여요." />
      </div>
      <p class="note">매출은 상품별 한국 정가 기준 추정이에요(스토어 환산 · 수수료 전). 광고 제거는 판매 시각의 가격으로 세요.</p>

      <h2 class="section-title">클럽 멤버십</h2>
      {@const last = v.days.at(-1)}
      {@const total = (m: string) => periodSum(v.days, (d) => valueOn(v.idx, d, m)).sum}
      {@const off = last ? valueOn(v.idx, last, 'members_autorenew_off') : null}
      {@const active = last ? valueOn(v.idx, last, 'members_active') : null}
      <div class="stats">
        <Stat label="구독 중 (어제 끝)" value={active} trend={v.days.map((d) => valueOn(v.idx, d, 'members_active'))} />
        <Stat label={`${days}일 새 가입`} value={total('members_new')} />
        <Stat label={`${days}일 갱신`} value={total('members_renewed')} sub="스토어 갱신 알림 기준" />
        <Stat label={`${days}일 만료`} value={total('members_expired')} sub="다시 결제하지 않고 끝난 구독" />
        <Stat
          label="자동 갱신 끔"
          value={off ?? (active === null ? null : 0)}
          sub={active ? `구독 중의 ${Math.round(((off ?? 0) / active) * 100)}% · 다음 결제일에 끝나요` : '어제 기준'}
        />
      </div>
      <div class="cols">
        <StackedBars
          title="멤버십 결제 (새 가입 · 갱신)"
          days={v.days}
          empty={MEMBER_EMPTY}
          series={nonEmpty(
            metricSeries(v.idx, v.days, [
              { metric: 'members_new', label: '새 가입' },
              { metric: 'members_renewed', label: '갱신' },
            ]),
          )}
        />
        <StackedBars title="멤버십 만료 (스토어별)" days={v.days} series={byDim(v, 'members_expired')} empty={MEMBER_EMPTY} />
        <StackedBars title="멤버십 구독 중 (스토어별)" days={v.days} series={byDim(v, 'members_active')} empty={KPI_EMPTY} />
      </div>
    {/snippet}
  </Load>
</div>
