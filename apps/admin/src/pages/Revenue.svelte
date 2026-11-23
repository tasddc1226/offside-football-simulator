<script lang="ts">
  // T-11-577 수익: 서버 원장(아이템) · 스토어 알림(광고 제거) 실시간 합 + 일일 수집(시즌 패스 · 멤버십 · 광고 수익).
  import type { AdminRevenue, KpiReport } from '@offside/contracts';
  import { dimLabel, fmt, KPI_EMPTY, metricSeries, nonEmpty, periodSum, productLabel, valueOn } from '../kpi.ts';
  import { byDim, dimTotals, periodTotal, trendOf, viewOf } from '../kpi-page.ts';
  import { formatName, placementName, placementTotals, webPayFunnel } from '../kpi-insights.ts';
  import { memberIntro, monetization } from '../kpi-money.ts';
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
  const avg = (krw: number, n: number) => (n ? `결제 건당 ${fmt(krw / n, 'krw')}` : '');
  const MEMBER_EMPTY = '멤버십 흐름은 다음 일일 수집(04:00)부터 보여요.';
  const PRODUCT_EMPTY = '상품별 판매는 이번 배포 뒤 다음 일일 수집(04:00)부터 보여요.';
  const WEBPAY_EMPTY = '웹 결제 주문은 이번 배포 뒤 다음 일일 수집(04:00)부터 보여요.';
  const ADS_EMPTY = '자리별 시청은 이번 배포 뒤 다음 일일 수집(04:00)부터 보여요.';
  const ADMOB_SPLIT_EMPTY = '형식 · 단위별 수익은 이번 배포 뒤 다음 AdMob 수집(08:50)부터 보여요.';
</script>

<div class="page">
  <p class="note">한국 정가 기준 추정 · 테스트 제외. 아이템·시즌 패스는 구매 기록, 멤버십(가입·갱신)·광고 제거는 스토어 알림 기준이며 알림 기록 전 판매는 빠져요. 구매자 수는 아이템·패스만 포함해요. 알림 환불은 접수일 가격으로 차감해요. 정확한 결제·환불액은 스토어 보고서에서 확인해 주세요.</p>
  <Load r={rev.r} height={128}>
    {#snippet children(r)}
      <div class="stats">
        <Stat label={`${days}일 전체 상품`} value={r.total.krw + r.removeAds.krw} unit="krw" trend={r.daily.map((x) => x.krw + (x.adKrw ?? 0))} />
        <Stat label="아이템·패스·멤버십" value={r.total.krw} unit="krw" sub={`${fmt(r.total.count)}건 · ${avg(r.total.krw, r.total.count)}`} />
        <Stat label="구매자 (아이템·패스)" value={r.total.buyers} sub={`첫 구매 ${fmt(r.total.firstBuyers)}명`} />
        <Stat label="광고 제거 (환불 반영)" value={r.removeAds.krw} unit="krw" sub={`${fmt(r.removeAds.count)}건 · 환불 ${fmt(r.removeAds.refunds)}`} />
        <Stat label="환불 (광고 제거 제외)" value={r.total.refundKrw} unit="krw" sub={`${fmt(r.total.refunds)}건`} />
        <Stat
          label="누적 매출"
          value={r.allTime.krw + (r.removeAds.allTime?.krw ?? 0)}
          unit="krw"
          sub={`아이템·패스 구매자 ${fmt(r.allTime.buyers)}명 · 광고 제거 ${fmt(r.removeAds.allTime?.count ?? null)}건`}
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
          title="일별 매출 (전체 상품)"
          unit="krw"
          days={r.daily.map((x) => x.day)}
          series={nonEmpty([
            { key: 'iap', label: '아이템·패스·멤버십', values: r.daily.map((x) => x.krw) },
            { key: 'ads', label: '광고 제거 (환불 반영)', values: r.daily.map((x) => x.adKrw ?? 0) },
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
            items={r.stores.map((s) => ({
              key: s.store, label: dimLabel(s.store), value: s.count, note: fmt(s.krw, 'krw'),
            })).sort((a, b) => b.value - a.value)}
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
              { metric: 'starter_krw', label: '첫 구매 묶음' },
            ]),
          )}
        />
        <StackedBars title="아이템 구매자 (스토어별)" days={v.days} series={byDim(v, 'iap_buyers')} empty={KPI_EMPTY} />
        <StackedBars
          title="아이템 판매 수 (상품별)"
          days={v.days}
          series={byDim(v, 'iap_product_count').map((s) => ({ ...s, label: productLabel(s.key) }))}
          empty={PRODUCT_EMPTY}
        />
        <StackedBars
          title="아이템 구매자 (상품별)"
          days={v.days}
          series={byDim(v, 'iap_product_buyers').map((s) => ({ ...s, label: productLabel(s.key) }))}
          empty={PRODUCT_EMPTY}
        />
        <StackedBars title="광고 수익 (AdMob)" unit="krw" days={v.days} series={byDim(v, 'ad_revenue_krw')} empty="AdMob 수집이 붙으면 보여요." />
      </div>
      <p class="note">매출은 상품별 한국 정가 기준 추정이에요(스토어 환산 · 수수료 전). 광고 제거는 판매 시각의 가격으로 세요.</p>

      <h2 class="section-title">광고 수익 · 시청 자리</h2>
      {@const places = placementTotals(v)}
      {@const uploads = periodTotal(v, 'ads_uploads')}
      {@const units = dimTotals(v, 'ad_revenue_unit_krw').filter((x) => x.value > 0)}
      <div class="stats">
        <Stat
          label={`${days}일 보상형 시청`}
          value={periodTotal(v, 'ads_rewarded')}
          sub={`광고 제거로 바로 받은 보상 ${fmt(periodTotal(v, 'ads_free_rewards'))}회`}
          trend={trendOf(v, 'ads_rewarded')}
        />
        <Stat label={`${days}일 은퇴 전면광고`} value={periodTotal(v, 'ads_interstitial')} trend={trendOf(v, 'ads_interstitial')} />
        <Stat
          label="광고 제거 상태로 올린 시즌"
          value={uploads ? (periodTotal(v, 'ads_uploads_ad_free') ?? 0) / uploads : null}
          unit="pct"
          sub={`시즌 업로드 ${fmt(uploads)}개 중`}
        />
      </div>
      <div class="cols">
        <StackedBars
          title="보상형 시청 (자리별)"
          days={v.days}
          series={byDim(v, 'ads_rewarded').map((x) => ({ ...x, label: placementName(x.key) }))}
          empty={ADS_EMPTY}
        />
        <StackedBars
          title="광고 수익 (플랫폼 · 형식별)"
          unit="krw"
          days={v.days}
          series={byDim(v, 'ad_revenue_format_krw').map((x) => ({ ...x, label: formatName(x.key) }))}
          empty={ADMOB_SPLIT_EMPTY}
        />
        <section class="panel">
          <header><h2>자리별 시청 · 받은 보상</h2><span class="hint">{days}일 합</span></header>
          {#if places.length}
            <HBars items={places.map((x) => ({ key: x.key, label: x.label, value: x.watched, note: x.free ? `광고 제거 ${fmt(x.free)}회` : undefined }))} />
          {:else}
            <p class="note">{ADS_EMPTY}</p>
          {/if}
        </section>
        <section class="panel">
          <header><h2>광고 단위별 수익</h2><span class="hint">{days}일 합</span></header>
          {#if units.length}
            <HBars
              unit="krw"
              items={units.map((x) => {
                const imp = periodTotal(v, 'ad_impressions_unit', [x.dim]);
                return { key: x.dim, label: x.dim, value: x.value, note: imp ? `노출 ${fmt(imp)} · 1천 회당 ${fmt((x.value / imp) * 1000, 'krw')}` : undefined };
              })}
            />
          {:else}
            <p class="note">{ADMOB_SPLIT_EMPTY}</p>
          {/if}
        </section>
      </div>
      <p class="note">시청 횟수는 시즌을 올릴 때 앱이 보낸 광고 요약(그 시즌 동안 본 횟수)을 올린 날로 모은 값이라 실제 시청 날과 하루쯤 어긋날 수 있어요. 광고 수익은 AdMob 추정 수익(모든 광고 소스 합)이에요.</p>

      <h2 class="section-title">사용자당 매출 · 결제 전환</h2>
      {@const mon = monetization(v)}
      <div class="stats">
        <Stat
          label="DAU당 매출 (스토어 + 광고)"
          value={mon.period.arpdau}
          unit="krw"
          sub={`DAU가 있는 ${fmt(mon.period.days)}일 합으로 계산`}
          trend={mon.arpdauStore.map((x, i) => (x === null && mon.arpdauAd[i] === null ? null : (x ?? 0) + (mon.arpdauAd[i] ?? 0)))}
        />
        <Stat label="결제 전환 (아이템 구매자 ÷ DAU)" value={mon.period.payerRate} unit="pct" trend={mon.payerRate} />
        <Stat label="결제한 사람당 아이템 매출" value={mon.period.arppu} unit="krw" sub="아이템 매출 ÷ 하루 구매자 합" />
      </div>
      <div class="cols">
        <StackedBars
          title="DAU당 매출 (원)"
          unit="krw"
          days={v.days}
          empty="DAU(GA4)와 매출이 함께 들어온 날부터 보여요."
          series={nonEmpty([
            { key: 'store', label: '스토어', values: mon.arpdauStore },
            { key: 'ad', label: '광고 (AdMob)', values: mon.arpdauAd },
          ])}
        />
      </div>
      <p class="note">DAU는 GA4 값을 쓰고, 없는 날은 운영 DB 접속 프로필로 대신해요. 스토어 매출은 아이템 · 광고 제거 · 시즌 패스 · 멤버십(새 가입 · 갱신) 정가 합이에요.</p>

      <h2 class="section-title">웹 결제 단계 (엑솔라)</h2>
      {@const wp = webPayFunnel(v)}
      <div class="stats">
        <Stat label={`${days}일 결제 주문`} value={wp.orders} trend={trendOf(v, 'webpay_orders')} sub="결제 창을 연 주문(테스트 제외)" />
        <Stat label="결제 완료율" value={wp.paidRate} unit="pct" trend={wp.daily} sub={`완료 ${fmt(wp.paid)} · 취소 ${fmt(wp.canceled)} · 그대로 둠 ${fmt(wp.open)}`} />
      </div>
      <div class="cols">
        <StackedBars
          title="웹 결제 주문 (완료 · 취소 · 그대로 둠)"
          days={v.days}
          empty={WEBPAY_EMPTY}
          series={nonEmpty([
            { key: 'paid', label: '완료', values: trendOf(v, 'webpay_paid') },
            { key: 'canceled', label: '취소', values: trendOf(v, 'webpay_canceled') },
            {
              key: 'open',
              label: '그대로 둠',
              values: v.days.map((d) => {
                const o = valueOn(v.idx, d, 'webpay_orders');
                return o === null ? null : Math.max(0, o - (valueOn(v.idx, d, 'webpay_paid') ?? 0) - (valueOn(v.idx, d, 'webpay_canceled') ?? 0));
              }),
            },
          ])}
        />
        <StackedBars title="웹 결제 완료 (상품별)" days={v.days} series={byDim(v, 'webpay_paid').map((s) => ({ ...s, label: productLabel(s.key) }))} empty={WEBPAY_EMPTY} />
      </div>
      <p class="note">주문을 만든 날 기준이에요. 늦게 결제를 마친 주문은 사흘 동안 다시 세어 채워요.</p>

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

      {@const intro = memberIntro(v)}
      <section class="panel" data-testid="member-intro">
        <header><h2>첫 달 할인 실험</h2><span class="hint">{intro ? `${intro.day}까지 합` : '11월 21일 가입부터'} · 앱 스토어에서 처음 구독한 사람</span></header>
        {#if intro}
          <table class="tbl">
            <thead>
              <tr>
                <th>스토어</th><th>군</th><th class="num">가입</th><th class="num">가입 (인원 맞춤)</th><th class="num">자동 갱신 끔</th>
                <th class="num">둘째 달 대상</th><th class="num">둘째 달 결제</th><th class="num">유지율</th>
              </tr>
            </thead>
            <tbody>
              {#each intro.groups as g (`${g.store}_${g.key}`)}
                <tr data-group={`${g.store}_${g.key}`}>
                  <td>{g.store === 'google' ? 'Android' : 'iOS'}</td>
                  <td>{g.key === 'offer' ? '할인 안내 (80%)' : g.store === 'google' ? '정상가 (20%)' : '안내 없음 (20%)'}</td>
                  <td class="num">{fmt(g.joined)}</td>
                  <td class="num">{fmt(g.joinedScaled)}</td>
                  <td class="num">{fmt(g.off)}</td>
                  <td class="num">{fmt(g.due)}</td>
                  <td class="num">{fmt(g.kept)}</td>
                  <td class="num">{g.keptRate === null ? '—' : fmt(g.keptRate, 'pct')}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {:else}
          <p class="note">아직 실험 대상 가입이 없어요.</p>
        {/if}
        <p class="note">
          구단주의 20%에게는 할인을 보이지 않아요. Android는 이 20%가 정상가로 결제해 가격 효과를 볼 수 있어요.
          iOS는 스토어가 할인을 자동으로 적용해 20%도 할인가로 결제하고, 화면의 할인 문구만 달라요.
          인원 맞춤은 20% 군 가입에 4를 곱한 값이에요. 할인 안내 군 가입이 이보다 많으면 할인이 가입을 늘린 거예요.
          둘째 달 대상은 가입한 지 35일이 지난 사람이고, 구독 기간이 45일을 넘으면 둘째 달을 결제한 것으로 세요.
        </p>
      </section>
    {/snippet}
  </Load>
</div>
