<script lang="ts">
  // T-11-577 게임 · 커뮤니티: 커리어 · 게시판 실시간 현황 + 일일 수집 추세.
  import type { AdminStats, KpiReport } from '@offside/contracts';
  import { fmt, KPI_EMPTY, metricSeries, nonEmpty, ratio } from '../kpi.ts';
  import { byDim, lastDims, lastValue, periodTotal, trendOf, viewOf } from '../kpi-page.ts';
  import { balanceHealth, PEAK_BANDS, seasonsPerDau } from '../kpi-insights.ts';
  import HBars from '../ui/HBars.svelte';
  import { loader } from '../load.svelte.ts';
  import Load from '../ui/Load.svelte';
  import Stat from '../ui/Stat.svelte';
  import StackedBars from '../ui/StackedBars.svelte';

  let { days, tick }: { days: number; tick: number } = $props();
  const stats = loader<AdminStats>(() => '/v1/admin/stats', () => tick);
  const kpi = loader<KpiReport>(() => `/v1/admin/kpi?days=${days}`, () => tick);
  const one = (v: ReturnType<typeof viewOf>, metric: string, label: string) =>
    nonEmpty(metricSeries(v.idx, v.days, [{ metric, label }]));
  const ROOM: Record<string, string> = { ko: '한국어 방', en: '영어 방', ja: '일본어 방', zh: '중국어 방' };
  const VOICE: Record<string, string> = { bug: '버그 의심', idea: '개선 제안', request: '요구사항', etc: '기타' };
  const AGENT_EMPTY = '매일 08:50(KST)에 전날 값을 받아요.';
  const BAL_EMPTY = '이번 배포 뒤 다음 일일 수집(04:00)부터 보여요.';
  const ENGAGE_EMPTY = '이번 배포 뒤 다음 일일 수집(04:00)부터 지난 사흘이 보여요.';
  const BAL_SUB = '운영자 · QA 커리어 포함';
  /** 서버 수집 기준(apps/api kpi.ts ELITE_OVR · ELITE_MAX_AGE)과 같게. */
  const ELITE_OVR = 95;
  const ELITE_AGE = 31;
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
    <Load r={kpi.r} height={260}>
      {#snippet children(rep)}
        {@const v = viewOf(rep)}
        <StackedBars
          title={`라운지 채팅 (${days}일)`}
          days={v.days}
          series={byDim(v, 'chat').map((s) => ({ ...s, label: ROOM[s.key] ?? s.key }))}
          empty="채팅방에 남은 최근 7일 안에서 매일 04:00(KST)에 세요."
        />
      {/snippet}
    </Load>
    <Load r={kpi.r} height={260}>
      {#snippet children(rep)}
        {@const v = viewOf(rep)}
        <StackedBars title={`컵 참가 신청 (${days}일)`} days={v.days} series={one(v, 'cup_entries', '참가 신청')} empty={KPI_EMPTY} />
      {/snippet}
    </Load>
    <Load r={kpi.r} height={260}>
      {#snippet children(rep)}
        {@const v = viewOf(rep)}
        <StackedBars title={`고객 문의 메일 (${days}일)`} days={v.days} series={one(v, 'support_mails', '받은 문의')} empty={AGENT_EMPTY} />
      {/snippet}
    </Load>
    <Load r={kpi.r} height={260}>
      {#snippet children(rep)}
        {@const v = viewOf(rep)}
        {@const open = lastDims(v, 'voice_open')}
        <section class="panel">
          <header>
            <h2>유저 반응 · 열린 주제</h2>
            <span class="hint">{open.day ? `${open.day} 기준 · ${days}일 새 주제 ${fmt(periodTotal(v, 'voice_new'))}개` : ''}</span>
          </header>
          {#if open.day}
            <HBars unit="n" items={open.items.map((x) => ({ key: x.dim, label: VOICE[x.dim] ?? x.dim, value: x.value }))} />
          {:else}
            <p class="note">{AGENT_EMPTY}</p>
          {/if}
        </section>
      {/snippet}
    </Load>
    <Load r={kpi.r} height={128}>
      {#snippet children(rep)}
        {@const v = viewOf(rep)}
        <div class="stats">
          <Stat label={`${days}일 채팅 쓴 사람 (하루 합)`} value={periodTotal(v, 'chat_writers')} trend={trendOf(v, 'chat_writers')} />
        </div>
      {/snippet}
    </Load>
  </div>

  <h2 class="section-title">플레이 깊이 ({days}일)</h2>
  <Load r={kpi.r} height={260}>
    {#snippet children(rep)}
      {@const v = viewOf(rep)}
      {@const per = seasonsPerDau(v)}
      {@const seasons = periodTotal(v, 'seasons_played', ['all'])}
      {@const careers = periodTotal(v, 'seasons_played', ['careers'])}
      {@const known = per.filter((x): x is number => x !== null)}
      <div class="stats">
        <Stat label={`${days}일 진행한 시즌`} value={seasons} trend={trendOf(v, 'seasons_played', ['all'])} sub="서버에 올라온 시즌 기록 기준" />
        <Stat
          label="DAU당 시즌 (하루 평균)"
          value={known.length ? Math.round((known.reduce((s, x) => s + x, 0) / known.length) * 10) / 10 : null}
          trend={per}
          sub="DAU는 GA4, 없는 날은 운영 DB 접속"
        />
        <Stat
          label="시즌을 진행한 커리어당 시즌 (하루)"
          value={seasons && careers ? Math.round((seasons / careers) * 10) / 10 : null}
          trend={trendOf(v, 'seasons_played', ['all']).map((n, i) => {
            const c = trendOf(v, 'seasons_played', ['careers'])[i];
            return c && n !== null ? n / c : null;
          })}
          sub="하루에 한 커리어를 몇 시즌 굴리는지"
        />
      </div>
      <div class="cols">
        <StackedBars
          title="하루 진행한 시즌"
          days={v.days}
          series={nonEmpty([{ key: 'all', label: '시즌', values: trendOf(v, 'seasons_played', ['all']) }])}
          empty={BAL_EMPTY}
        />
      </div>
    {/snippet}
  </Load>

  <h2 class="section-title">출석 · 이적시장 ({days}일)</h2>
  <Load r={kpi.r} height={260}>
    {#snippet children(rep)}
      {@const v = viewOf(rep)}
      {@const checkins = periodTotal(v, 'attendance_checkins')}
      {@const adBonus = periodTotal(v, 'attendance_ad_bonus')}
      {@const sold = periodTotal(v, 'market_sold')}
      {@const volume = periodTotal(v, 'market_volume')}
      {@const fee = periodTotal(v, 'market_fee')}
      {@const open = lastValue(v, 'market_open')}
      <div class="stats">
        <Stat label={`${days}일 출석 (하루 합)`} value={checkins} trend={trendOf(v, 'attendance_checkins')} sub="그날 출석 도장을 찍은 구단주" />
        <Stat
          label="광고 보고 한 번 더 받기"
          value={checkins && adBonus !== null ? ratio(adBonus, checkins) : null}
          unit="pct"
          trend={trendOf(v, 'attendance_checkins').map((n, i) => {
            const a = trendOf(v, 'attendance_ad_bonus')[i];
            return n && a != null ? a / n : null;
          })}
          sub={`출석 가운데 · ${fmt(adBonus)}번`}
        />
        <Stat label={`${days}일 이적시장 거래`} value={sold} trend={trendOf(v, 'market_sold')} sub={`거래 대금 ${fmt(volume)}만 원 · 수수료 ${fmt(fee)}만 원`} />
        <Stat label="열린 판매 등록" value={open?.value ?? null} trend={trendOf(v, 'market_open')} sub={open ? `${open.day} 끝 기준` : ''} />
      </div>
      <div class="cols">
        <StackedBars
          title="하루 출석"
          days={v.days}
          series={nonEmpty([
            {
              key: 'plain',
              label: '출석만',
              values: trendOf(v, 'attendance_checkins').map((n, i) => {
                const a = trendOf(v, 'attendance_ad_bonus')[i];
                return n === null ? null : n - (a ?? 0);
              }),
            },
            { key: 'ad', label: '광고로 한 번 더', values: trendOf(v, 'attendance_ad_bonus') },
          ])}
          empty={ENGAGE_EMPTY}
        />
        <StackedBars
          title="이적시장 하루 등록 · 거래 · 취소"
          days={v.days}
          series={nonEmpty([
            { key: 'listed', label: '새 등록', values: trendOf(v, 'market_listed') },
            { key: 'sold', label: '팔림', values: trendOf(v, 'market_sold') },
            { key: 'cancelled', label: '취소', values: trendOf(v, 'market_cancelled') },
          ])}
          empty={ENGAGE_EMPTY}
        />
        <StackedBars
          title="이적시장 하루 산 사람 · 판 사람"
          days={v.days}
          series={nonEmpty([
            { key: 'buyers', label: '산 사람', values: trendOf(v, 'market_buyers') },
            { key: 'sellers', label: '판 사람', values: trendOf(v, 'market_sellers') },
          ])}
          empty={ENGAGE_EMPTY}
        />
      </div>
    {/snippet}
  </Load>

  <h2 class="section-title">밸런스 이상 감시 ({days}일)</h2>
  <p class="note">그날 은퇴한 커리어와 그날 올라온 시즌으로 매일 04:00(KST)에 세요. 평균은 은퇴 수로 가중해요. 최상위 시즌은 OVR {ELITE_OVR} 이상 · {ELITE_AGE}세 이하 시즌이고, 이적률은 그 가운데 전 시즌과 구단이 다른 비율이에요.</p>
  <Load r={kpi.r} height={260}>
    {#snippet children(rep)}
      {@const v = viewOf(rep)}
      {@const h = balanceHealth(v)}
      {@const avg = (x: number | null, d = 1) => (x === null ? null : Math.round(x * 10 ** d) / 10 ** d)}
      <div class="stats">
        <Stat label="은퇴 나이 (평균)" value={avg(h.age)} trend={trendOf(v, 'bal_retired_age')} sub={BAL_SUB} />
        <Stat label="은퇴 선수 최고 OVR (평균)" value={avg(h.peak)} trend={trendOf(v, 'bal_retired_peak')} sub={BAL_SUB} />
        <Stat label="레전드 점수 (평균)" value={avg(h.legend, 0)} trend={trendOf(v, 'bal_retired_legend')} sub={BAL_SUB} />
        <Stat label="발롱도르 받고 은퇴" value={h.ballon.period} unit="pct" trend={h.ballon.values} sub={BAL_SUB} />
        <Stat
          label="최상위 선수 이적률"
          value={h.eliteMoved.period}
          unit="pct"
          trend={h.eliteMoved.values}
          sub={`최상위 시즌 ${fmt(periodTotal(v, 'bal_elite_seasons'))}개 중 ${fmt(periodTotal(v, 'bal_elite_moved'))}개`}
        />
      </div>
      <div class="cols">
        <StackedBars
          title="은퇴 선수 최고 OVR 구간"
          days={v.days}
          series={nonEmpty(PEAK_BANDS.map((b) => ({ key: b.key, label: b.label, values: trendOf(v, 'bal_retired_peak_band', [b.key]) })))}
          empty={BAL_EMPTY}
        />
        <StackedBars
          title="최상위 시즌 (구단 옮김 · 그대로)"
          days={v.days}
          series={nonEmpty([
            { key: 'moved', label: '옮김', values: trendOf(v, 'bal_elite_moved') },
            {
              key: 'stay',
              label: '그대로',
              values: v.days.map((_, i) => {
                const all = trendOf(v, 'bal_elite_seasons')[i];
                return all == null ? null : all - (trendOf(v, 'bal_elite_moved')[i] ?? 0);
              }),
            },
          ])}
          empty={BAL_EMPTY}
        />
      </div>

      <h2 class="section-title">새 기능 쓰는 비율 (그날 은퇴 기준)</h2>
      <div class="stats">
        <Stat label="명품 경매 소장품을 갖고 은퇴" value={h.itemTop.period} unit="pct" trend={h.itemTop.values} sub={BAL_SUB} />
        <Stat label="레거시 등급을 갖고 은퇴" value={h.legacy.period} unit="pct" trend={h.legacy.values} sub={BAL_SUB} />
      </div>
      <div class="cols">
        <StackedBars
          title="은퇴 때 가장 높은 소장품 등급"
          days={v.days}
          series={byDim(v, 'retired_item_top').map((x) => ({ ...x, label: x.key === '0' ? '없음' : `${x.key}등급` }))}
          empty={BAL_EMPTY}
        />
        <StackedBars
          title="은퇴 때 레거시 등급"
          days={v.days}
          series={byDim(v, 'retired_legacy').map((x) => ({ ...x, label: x.key === '0' ? '없음' : `${x.key}등급` }))}
          empty={BAL_EMPTY}
        />
      </div>
    {/snippet}
  </Load>
</div>
