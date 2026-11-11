<script lang="ts">
  // T-11-577 푸시: 보낸 알림이 기기에 닿고 눌렸는지, 알림을 받겠다고 한 기기가 얼마나 되는지.
  // T-11-693 화면을 열 때 운영 표를 훑던 집계(8초, 뒤따른 요청 503)를 일일 수집(kpi_daily)으로 옮겼다. 최근 알림 목록 · 복귀 알림
  // 효과는 아래 버튼을 눌렀을 때만 부른다.
  import type { KpiReport } from '@offside/contracts';
  import { fmt, KPI_EMPTY, ratio } from '../kpi.ts';
  import { dimTotals, lastDims, periodTotal, trendOf, viewOf, type KpiView } from '../kpi-page.ts';
  import { loader } from '../load.svelte.ts';
  import HBars from '../ui/HBars.svelte';
  import Load from '../ui/Load.svelte';
  import Stat from '../ui/Stat.svelte';
  import StackedBars from '../ui/StackedBars.svelte';
  import PushDetail from './PushDetail.svelte';

  let { days, tick }: { days: number; tick: number } = $props();
  const kpi = loader<KpiReport>(() => `/v1/admin/kpi?days=${days}`, () => tick);
  let detail = $state<0 | 1 | 7>(0);

  /** 알림 주제(T-11-685) · 옛 종류 · 게시판 이름. */
  const TOPIC: Record<string, string> = {
    match: '내 경기 결과',
    cup: '컵 대회',
    league: '리그',
    market: '이적시장',
    friend: '친구',
    reward: '보상 · 선물',
    attendance: '출석 알림',
    comeback: '돌아오기 소식',
    notice: '공지',
    release: '업데이트',
    team: '구단 (주제 없음)',
    social: '라운지 · 친구 (주제 없음)',
    return: '복귀 (주제 없음)',
    news: '게시판 새 글',
    community: '게시판',
    etc: '기타',
  };
  const PERMISSION: Record<string, string> = {
    authorized: '정식 허용',
    provisional: '조용한 알림 (iOS)',
    unknown: '옛 앱 (상태 모름)',
  };
  const PLATFORM: Record<string, string> = { ios: 'iOS', android: 'Android' };
  const STEPS = [
    { key: 'view', label: '권유 봄' },
    { key: 'accept', label: '받기 누름' },
    { key: 'pick', label: '묶음 고름' },
    { key: 'result:granted', label: 'OS 허용' },
    { key: 'result:denied', label: 'OS 거절' },
    { key: 'result:blocked', label: '설정에서 막힘' },
    { key: 'later', label: '나중에' },
  ];
  const pct = (a: number | null, b: number | null) =>
    fmt(a === null || b === null ? null : ratio(a, b), 'pct');
  const byTopic = (v: KpiView) => {
    const delivered = new Map(dimTotals(v, 'push_delivered').map((x) => [x.dim, x.value]));
    return dimTotals(v, 'push_clicked')
      .map(({ dim, value }) => ({ dim, clicked: value, delivered: delivered.get(dim) ?? 0 }))
      .filter((x) => x.delivered > 0);
  };
  const reached = (v: KpiView) => {
    const clicks = trendOf(v, 'push_clicked');
    return trendOf(v, 'push_delivered').map((a, i) =>
      a === null ? null : Math.max(0, a - (clicks[i] ?? 0)),
    );
  };
  const devices = (v: KpiView, platform: string) => {
    const last = lastDims(v, 'push_devices');
    const items = last.items.filter((x) => x.dim.startsWith(`${platform}:`));
    return { day: last.day, items, total: items.reduce((s, x) => s + x.value, 0) };
  };
</script>

<div class="page">
  <Load r={kpi.r} height={420}>
    {#snippet children(rep)}
      {@const v = viewOf(rep)}
      {@const recipients = periodTotal(v, 'push_recipients')}
      {@const delivered = periodTotal(v, 'push_delivered')}
      {@const clicked = periodTotal(v, 'push_clicked')}
      {@const failed = periodTotal(v, 'push_failed')}
      <div class="stats">
        <Stat label={`${days}일 받는 사람`} value={recipients} sub="알림 한 건을 한 사람으로 세요" trend={trendOf(v, 'push_recipients')} />
        <Stat label="기기 도달" value={delivered} sub={`받는 사람의 ${pct(delivered, recipients)} · 발송 실패 ${fmt(failed)}`} />
        <Stat label="클릭" value={clicked} sub={`도달의 ${pct(clicked, delivered)}`} trend={trendOf(v, 'push_clicked')} />
      </div>
      <div class="cols">
        <StackedBars
          title={`하루 도달 · 클릭 (${days}일)`}
          days={v.days}
          series={recipients === null
            ? []
            : [
                { key: 'reached', label: '도달 (클릭 안 함)', values: reached(v) },
                { key: 'clicked', label: '클릭', values: trendOf(v, 'push_clicked') },
              ]}
          empty={KPI_EMPTY}
        />
        <section class="panel">
          <header><h2>주제별 클릭</h2><span class="hint">클릭 / 도달 · 클릭률</span></header>
          <HBars
            unit="n"
            items={byTopic(v).map((x) => ({
              key: x.dim,
              label: TOPIC[x.dim] ?? x.dim,
              value: x.clicked,
              note: `/ ${fmt(x.delivered)} · ${pct(x.clicked, x.delivered)}`,
            }))}
          />
        </section>
      </div>

      <div class="cols">
        {#each Object.keys(PLATFORM) as platform (platform)}
          {@const d = devices(v, platform)}
          <section class="panel">
            <header><h2>{PLATFORM[platform]} 알림 기기</h2><span class="hint">{d.day ? `${d.day} 끝 기준 · 모두 ${fmt(d.total)}대` : ''}</span></header>
            <HBars
              unit="n"
              items={d.items.map((x) => {
                const key = x.dim.split(':')[1] ?? 'unknown';
                return { key: x.dim, label: PERMISSION[key] ?? key, value: x.value, note: pct(x.value, d.total) };
              })}
            />
          </section>
        {/each}
      </div>

      <section class="panel">
        <header><h2>알림 권유 퍼널 ({days}일)</h2><span class="hint">GA4 · 하루 사용자 수의 합이라 여러 날 본 사람은 겹쳐요</span></header>
        {#if periodTotal(v, 'push_optin_users') === null}
          <p class="note">아직 들어온 값이 없어요. 매일 08:50(KST)에 전날 값을 받아요.</p>
        {:else}
          <div class="tbl-wrap"><table class="tbl">
            <thead>
              <tr><th>단계</th>{#each Object.keys(PLATFORM) as p (p)}<th class="num">{PLATFORM[p]}</th><th class="num">권유 대비</th>{/each}</tr>
            </thead>
            <tbody>
              {#each STEPS as s (s.key)}
                <tr>
                  <td>{s.label}</td>
                  {#each Object.keys(PLATFORM) as p (p)}
                    {@const n = periodTotal(v, 'push_optin_users', [`${p}:${s.key}`])}
                    <td class="num">{fmt(n ?? 0)}</td>
                    <td class="num">{s.key === 'view' ? '' : pct(n ?? 0, periodTotal(v, 'push_optin_users', [`${p}:view`]))}</td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table></div>
          <p class="note">묶음 고름은 선택 창(T-11-685, 11-10 배포) 뒤부터 있어요. OS 허용에는 설정 화면에서 켠 경우도 들어가요.</p>
        {/if}
      </section>
    {/snippet}
  </Load>

  {#if detail}
    {#key detail}
      <PushDetail days={detail} {tick} />
    {/key}
  {:else}
    <section class="panel">
      <header><h2>최근 알림 · 복귀 알림 효과</h2></header>
      <p class="note">운영 표에서 알림 며칠치를 바로 읽어요. 7일은 몇 초 걸리고 그동안 게임 요청이 느려질 수 있어, 사람이 몰리는 저녁에는 오늘만 보세요.</p>
      <div class="row">
        <button class="btn" onclick={() => (detail = 1)}>오늘 보낸 알림 보기</button>
        <button class="btn" onclick={() => (detail = 7)}>최근 7일 보기</button>
      </div>
    </section>
  {/if}
</div>

<style>
  .row {
    display: flex;
    gap: 8px;
    padding: 0 0 4px;
  }
  .btn {
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--text);
    border-radius: 8px;
    padding: 6px 12px;
    font: inherit;
    font-size: 13px;
    cursor: pointer;
  }
</style>
