<script lang="ts">
  // T-11-577 그로스: Meta 광고 지출 · 설치 · 클릭(에이전트가 매일 08:50 넣는다)과 설치당 비용, 국가별 성과, 스토어 리뷰 · 평점 · 설치.
  import type { KpiReport } from '@offside/contracts';
  import { dimLabel, fmt, periodSum, valueOn } from '../kpi.ts';
  import { byDim, dimTotals, lastValue, trendOf, viewOf } from '../kpi-page.ts';
  import { acqFunnel, adFunnel, campaignName } from '../kpi-insights.ts';
  import { loader } from '../load.svelte.ts';
  import Load from '../ui/Load.svelte';
  import Stat from '../ui/Stat.svelte';
  import StackedBars from '../ui/StackedBars.svelte';

  let { days, tick }: { days: number; tick: number } = $props();
  const kpi = loader<KpiReport>(() => `/v1/admin/kpi?days=${days}`, () => tick);
  const META_EMPTY = 'Meta 광고 수집(매일 08:50) 뒤 보여요.';
  const ACQ_EMPTY = '이번 배포 뒤 다음 일일 수집(04:00)부터 보여요.';
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
      <!-- T-11-761 광고 유입 퍼널: Meta 소재(utm)별 지출 · 랜딩 조회와 서버 방문 · 커리어 시작 · 은퇴 · 로그인 연결을 잇는다. -->
      {@const af = adFunnel(v)}
      <h2 class="section-title first">광고 유입 퍼널 (Meta → 게임)</h2>
      {#if af.creatives.length}
        {@const started = af.steps.find((x) => x.key === 'started')}
        {@const retired = af.steps.find((x) => x.key === 'retired')}
        <div class="stats">
          <Stat label="소재 지출"
            value={af.spend}
            unit="krw"
            sub={af.spendDays ? `소재별 수집 ${af.spendDays}일 · 아래 단계도 이 날들만` : '소재별 지출 수집 전 · 서버 단계만'}
          />
          <Stat label="커리어 시작" value={started?.value ?? null} sub={started?.rate != null ? `서버 방문의 ${fmt(started.rate, 'pct')}` : ''} />
          <Stat label="시작 1건당" value={started?.cost ?? null} unit="krw" sub="소재 지출 ÷ 커리어 시작" trend={af.dailyCostPerStart} />
          <Stat label="은퇴 1건당" value={retired?.cost ?? null} unit="krw" sub="한 선수를 은퇴까지 키운 방문" />
        </div>
        <div class="cols wide">
          <section class="panel">
            <header><h2>단계별 전환</h2><span class="hint">{af.spendDays ? `소재 지출이 있는 ${af.spendDays}일` : `${days}일`} · 방문한 날 기준</span></header>
            <table class="tbl funnel">
              <thead><tr><th>단계</th><th class="num">수</th><th class="num">앞 단계 대비</th><th class="num">1건당 지출</th></tr></thead>
              <tbody>
                {#each af.steps as st (st.key)}
                  <tr data-step={st.key}>
                    <td>{st.label}</td>
                    <td class="num">{fmt(st.value)}</td>
                    <td class="num">{st.rate === null ? '—' : fmt(st.rate, 'pct')}</td>
                    <td class="num">{st.key === 'impressions' ? `${fmt(st.cost, 'krw')} /천 회` : fmt(st.cost, 'krw')}</td>
                  </tr>
                {/each}
                <tr class="side"><td>스토어 클릭</td><td class="num">{fmt(af.storeClicks)}</td><td class="num">—</td><td class="num">—</td></tr>
              </tbody>
            </table>
          </section>
          <StackedBars
            title="커리어 시작 (소재별)"
            days={v.days}
            series={byDim(v, 'acq_started')
              .filter((x) => af.creatives.some((c) => c.dim === x.key))
              .map((x) => ({ ...x, label: campaignName(x.key) }))}
            empty={ACQ_EMPTY}
          />
        </div>
        <section class="panel">
          <header><h2>소재별 퍼널</h2><span class="hint">지출 많은 순 · 같은 utm 링크를 쓰는 광고는 한 줄</span></header>
          <div class="tbl-wrap">
            <table class="tbl">
              <thead>
                <tr>
                  <th>소재</th><th class="num">지출</th><th class="num">클릭</th><th class="num">랜딩 조회</th><th class="num">서버 방문</th>
                  <th class="num">커리어 시작</th><th class="num">은퇴</th><th class="num">로그인 연결</th><th class="num">스토어 클릭</th>
                  <th class="num">시작 1건당</th><th class="num">은퇴 1건당</th>
                </tr>
              </thead>
              <tbody>
                {#each af.creatives as c (c.dim)}
                  <tr data-creative={c.dim}>
                    <td>{c.label}</td>
                    <td class="num">{fmt(c.spend, 'krw')}</td>
                    <td class="num">{fmt(c.clicks)}</td>
                    <td class="num">{fmt(c.lpv)}</td>
                    <td class="num">{fmt(c.visits)}</td>
                    <td class="num">{fmt(c.started)}{#if c.startRate !== null} <small>({fmt(c.startRate, 'pct')})</small>{/if}</td>
                    <td class="num">{fmt(c.retired)}</td>
                    <td class="num">{fmt(c.linked)}</td>
                    <td class="num">{fmt(c.storeClicks)}</td>
                    <td class="num">{fmt(c.costPerStart, 'krw')}</td>
                    <td class="num">{fmt(c.costPerRetired, 'krw')}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </section>
        {#if af.platforms.rows.length}
          <section class="panel">
            <header>
              <h2>게재 플랫폼별</h2>
              <span class="hint">플랫폼 지출이 들어온 {af.platforms.days}일 · 서버 칸은 광고 링크의 utm_term으로 세요</span>
            </header>
            <div class="tbl-wrap">
              <table class="tbl">
                <thead>
                  <tr>
                    <th>플랫폼</th><th class="num">지출</th><th class="num">비중</th><th class="num">랜딩 조회</th>
                    <th class="num">서버 방문</th><th class="num">커리어 시작</th><th class="num">시작 1건당</th>
                  </tr>
                </thead>
                <tbody>
                  {#each af.platforms.rows as p (p.dim)}
                    <tr data-platform={p.dim}>
                      <td>{p.label}</td>
                      <td class="num">{fmt(p.spend, 'krw')}</td>
                      <td class="num">{fmt(p.share, 'pct')}</td>
                      <td class="num">{fmt(p.lpv)}</td>
                      <td class="num">{af.platforms.hasServer ? fmt(p.visits) : '—'}</td>
                      <td class="num">{af.platforms.hasServer ? fmt(p.started) : '—'}</td>
                      <td class="num">{af.platforms.hasServer ? fmt(p.costPerStart, 'krw') : '—'}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
            {#if !af.platforms.hasServer}
              <p class="note">광고 링크에 utm_term=&#123;&#123;site_source_name&#125;&#125;-&#123;&#123;placement&#125;&#125;를 붙인 뒤부터 서버 방문 · 시작이 플랫폼별로 보여요.</p>
            {/if}
          </section>
        {/if}
        <p class="note">
          지출 · 클릭 · 랜딩 조회는 Meta(매일 08:50), 서버 방문부터는 운영 DB(매일 04:00) 값이에요. 서버 방문은 이용 분석에 동의한 방문만 세서
          랜딩 조회보다 적어요(광고 첫 방문은 소개 페이지를 먼저 거쳐요). 커리어 시작 · 은퇴 · 로그인 연결은 그날 들어온 방문 가운데 이어진 수라
          사흘 동안 늘어요. 은퇴는 그 방문의 기기 프로필에 은퇴한 선수가 있는지, 로그인 연결은 지금 Google · Apple에 이어져 있는지로 세요.
          utm 링크가 없는 광고(앱 설치 광고)는 이 표에서 빠지고 위 세트별 지출에만 보여요.
        </p>
      {:else}
        <p class="note">Meta 소재별 수집(매일 08:50)이 처음 돈 뒤부터 보여요. 지난날은 KPI ingest now 실행의 meta_funnel_backfill_days로 채워요.</p>
      {/if}

      <h2 class="section-title">광고 · 세트</h2>
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
        <Stat label={`${days}일 새 리뷰`} value={reviews.sum} sub={join(stars === null ? '' : `평균 ${stars.toFixed(1)}점`, gap(reviews))} />
        <Stat label="App Store 첫 다운로드" value={sum('store_installs', ['ios']).sum} sub="판매 보고서 · 하루 늦어요" />
        <Stat label="Play 설치" value={sum('store_installs', ['android']).sum} sub="통계 보고서 · 며칠 늦어요" />
      </div>
      <div class="cols">
        <StackedBars title="새 리뷰 (스토어별)" days={v.days} series={byDim(v, 'store_reviews_new')} empty="스토어 리뷰 수집(매일 08:50) 뒤 보여요." />
        <StackedBars title="스토어 설치" days={v.days} series={byDim(v, 'store_installs')} empty="스토어 설치 보고서가 연결되면 보여요." />
      </div>
      {@const funnel = acqFunnel(v)}
      <h2 class="section-title">유입 캠페인 단계 (서버 기준)</h2>
      <div class="cols">
        <StackedBars
          title="유입 방문 (캠페인별)"
          days={v.days}
          series={byDim(v, 'acq_visits').map((s) => ({ ...s, label: campaignName(s.key) }))}
          empty={ACQ_EMPTY}
        />
        <section class="panel">
          <header><h2>캠페인별 전환</h2><span class="hint">{days}일 · 방문한 날 기준</span></header>
          {#if funnel.length}
            <div class="tbl-wrap">
              <table class="tbl">
                <thead><tr><th>캠페인</th><th class="num">방문</th><th class="num">커리어 시작</th><th class="num">스토어 클릭</th></tr></thead>
                <tbody>
                  {#each funnel as f (f.dim)}
                    <tr>
                      <td>{f.label}</td>
                      <td class="num">{fmt(f.visits)}</td>
                      <td class="num">{fmt(f.started)} ({fmt(f.startRate, 'pct')})</td>
                      <td class="num">{fmt(f.clicks)} ({fmt(f.clickRate, 'pct')})</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {:else}
            <p class="note">{ACQ_EMPTY}</p>
          {/if}
        </section>
      </div>
      <p class="note">캠페인 링크(utm)로 들어온 방문을 서버가 센 값이에요. 커리어 시작 · 스토어 클릭은 그날 들어온 방문 가운데 이어진 수라 사흘 동안 조금씩 늘어요. 캠페인은 출처 · 캠페인 · 소재로 묶어요.</p>
      {@const ig = lastValue(v, 'followers', ['instagram'])}
      {@const th = lastValue(v, 'followers', ['threads'])}
      <div class="stats">
        <Stat label="인스타그램 팔로워" value={ig?.value ?? null} sub={ig ? `${ig.day} 기준` : '매일 08:50(KST) 수집 뒤 보여요'} trend={trendOf(v, 'followers', ['instagram'])} />
        <Stat label="Threads 팔로워" value={th?.value ?? null} sub={th ? `${th.day} 기준` : '매일 08:50(KST) 수집 뒤 보여요'} trend={trendOf(v, 'followers', ['threads'])} />
        <Stat label={`${days}일 검색 클릭`} value={sum('search_clicks').sum} sub={`노출 ${fmt(sum('search_impressions').sum)} · 최근 2~3일은 아직 덜 찼어요`} trend={trendOf(v, 'search_clicks')} />
      </div>
      <div class="cols">
        <StackedBars title="Google 검색 클릭 (offside-lab.com)" days={v.days} series={byDim(v, 'search_clicks').map((s) => ({ ...s, label: '클릭' }))} empty="검색 성과 수집(매일 08:50) 뒤 보여요." />
        <StackedBars title="Google 검색 노출" days={v.days} series={byDim(v, 'search_impressions').map((s) => ({ ...s, label: '노출' }))} empty="검색 성과 수집(매일 08:50) 뒤 보여요." />
      </div>
    {/snippet}
  </Load>
</div>

<style>
  .section-title.first {
    margin-top: 0;
  }
  .funnel tr.side td {
    color: var(--text-2);
  }
</style>
