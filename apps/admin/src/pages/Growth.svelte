<script lang="ts">
  // T-11-577 그로스: Meta 광고 지출 · 설치 · 클릭(에이전트가 매일 08:50 넣는다)과 설치당 비용, 국가별 성과, 스토어 리뷰 · 평점 · 설치.
  import type { KpiReport } from '@offside/contracts';
  import { dimLabel, fmt, periodSum, valueOn } from '../kpi.ts';
  import { byDim, dimTotals, viewOf } from '../kpi-page.ts';
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
      </div>

      <h2 class="section-title">국가별 광고 ({days}일)</h2>
      {@const countries = (() => {
        const installs = new Map(dimTotals(v, 'ad_installs_country').map((x) => [x.dim, x.value]));
        const clicks = new Map(dimTotals(v, 'ad_clicks_country').map((x) => [x.dim, x.value]));
        return dimTotals(v, 'ad_spend_country_krw').map((x) => ({
          ...x,
          installs: installs.get(x.dim) ?? 0,
          clicks: clicks.get(x.dim) ?? 0,
        }));
      })()}
      {#if countries.length}
        <section class="panel">
          <header><h2>국가별 지출 · 설치</h2><span class="hint">Meta 계정 전체를 국가로 나눔 · 지출 많은 순</span></header>
          <table class="tbl">
            <thead>
              <tr><th>국가</th><th class="num">지출</th><th class="num">설치</th><th class="num">설치당</th><th class="num">클릭</th></tr>
            </thead>
            <tbody>
              {#each countries as c (c.dim)}
                <tr>
                  <td>{dimLabel(c.dim)}</td>
                  <td class="num">{fmt(c.value, 'krw')}</td>
                  <td class="num">{fmt(c.installs)}</td>
                  <td class="num">{c.installs ? fmt(c.value / c.installs, 'krw') : '—'}</td>
                  <td class="num">{fmt(c.clicks)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </section>
      {:else}
        <p class="note">국가별 수집(매일 08:50)이 처음 돈 날부터 보여요.</p>
      {/if}

      <h2 class="section-title">스토어</h2>
      {@const lastOf = (m: string, dims?: string[]) => {
        for (const d of [...v.days].reverse()) {
          const x = valueOn(v.idx, d, m, dims);
          if (x !== null) return x;
        }
        return null;
      }}
      {@const reviews = sum('store_reviews_new')}
      {@const stars = (() => {
        let total = 0;
        let n = 0;
        for (const d of v.days)
          for (const st of ['ios', 'android']) {
            const c = valueOn(v.idx, d, 'store_reviews_new', [st]);
            const a = valueOn(v.idx, d, 'store_review_stars', [st]);
            if (c && a !== null) {
              total += a * c;
              n += c;
            }
          }
        return n ? total / n : null;
      })()}
      <div class="stats">
        <Stat label="App Store 평점" value={lastOf('store_rating', ['ios'])} sub="한국 스토어 · 최근 수집" />
        <Stat label={`${days}일 새 리뷰`} value={reviews.sum} sub={join(stars === null ? '' : `평균 ${stars.toFixed(1)}점`, gap(reviews))} />
        <Stat label="스토어 설치" value={sum('store_installs').sum} sub="App Store 첫 다운로드 + Play 설치" />
      </div>
      <div class="cols">
        <StackedBars title="새 리뷰 (스토어별)" days={v.days} series={byDim(v, 'store_reviews_new')} empty="스토어 리뷰 수집(매일 08:50) 뒤 보여요." />
        <StackedBars title="스토어 설치" days={v.days} series={byDim(v, 'store_installs')} empty="스토어 설치 보고서가 연결되면 보여요." />
      </div>
    {/snippet}
  </Load>
</div>
