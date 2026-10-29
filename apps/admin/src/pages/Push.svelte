<script lang="ts">
  // T-11-577 푸시: 보낸 알림이 기기에 닿고(수락) 눌렸는지(클릭 · 화면 열림), 복귀 알림은 비교군과 함께.
  // GET /v1/admin/push-performance(운영 도구 푸시 성과와 같은 집계)를 기간만 맞춰 읽는다.
  import type { PushCategory, PushPerformance } from '@offside/contracts';
  import { fmt, kstTime, ratio } from '../kpi.ts';
  import { loader } from '../load.svelte.ts';
  import HBars from '../ui/HBars.svelte';
  import Load from '../ui/Load.svelte';
  import Stat from '../ui/Stat.svelte';
  import StackedBars from '../ui/StackedBars.svelte';

  let { days, tick }: { days: number; tick: number } = $props();
  const perf = loader<PushPerformance>(() => `/v1/admin/push-performance?days=${days}`, () => tick);

  const CATEGORY: Record<PushCategory, string> = {
    notice: '공지',
    release: '업데이트',
    team: '구단',
    market: '이적시장',
    social: '라운지',
    community: '게시판',
    'friend-request': '친구 요청',
    'friend-accepted': '친구 수락',
    friendly: '친선 경기',
    return: '복귀 알림',
    test: '시험',
  };
  const NUDGE: Record<string, string> = { lapsed: '쉬는 구단주', onboarding: '새 구단주' };
  const pct = (a: number, b: number) => fmt(ratio(a, b), 'pct');
</script>

<div class="page">
  <Load r={perf.r} height={420}>
    {#snippet children(p)}
      {@const t = p.totals}
      <div class="stats">
        <Stat label={`${days}일 받는 사람`} value={t.recipients} sub={`보낸 알림 ${fmt(t.queued)}건`} trend={p.daily.map((d) => d.recipients)} />
        <Stat label="기기 도달" value={t.acceptedRecipients} sub={`받는 사람의 ${pct(t.acceptedRecipients, t.recipients)} · 실패 ${fmt(t.failed)}`} />
        <Stat label="클릭" value={t.clicked} sub={`도달의 ${pct(t.clicked, t.acceptedRecipients)}`} trend={p.daily.map((d) => d.clicked)} />
        <Stat label="화면 열림" value={t.targetOpened} sub={`클릭의 ${pct(t.targetOpened, t.clicked)}`} />
      </div>
      <div class="cols">
        <StackedBars
          title="하루 도달 · 클릭"
          days={p.daily.map((d) => d.day)}
          series={[
            { key: 'reached', label: '도달 (클릭 안 함)', values: p.daily.map((d) => Math.max(0, d.acceptedRecipients - d.clicked)) },
            { key: 'clicked', label: '클릭', values: p.daily.map((d) => d.clicked) },
          ]}
          empty="기간 안 보낸 알림이 없어요."
        />
        <section class="panel">
          <header><h2>종류별 클릭</h2><span class="hint">클릭 / 도달 · 클릭률</span></header>
          <HBars
            unit="n"
            items={p.categories
              .filter((c) => c.acceptedRecipients > 0)
              .map((c) => ({
                key: c.category,
                label: CATEGORY[c.category],
                value: c.clicked,
                note: `/ ${fmt(c.acceptedRecipients)} · ${pct(c.clicked, c.acceptedRecipients)}`,
              }))
              .sort((a, b) => b.value - a.value)}
          />
        </section>
      </div>

      {#if p.nudges?.length}
        <section class="panel">
          <header><h2>복귀 알림 효과</h2><span class="hint">보낸 쪽 vs 안 보낸 비교군 · 돌아온 비율</span></header>
          <table class="tbl">
            <thead>
              <tr><th>대상</th><th class="num">단계</th><th class="num">보냄</th><th class="num">돌아옴</th><th class="num">비교군</th><th class="num">돌아옴</th><th class="num">차이</th></tr>
            </thead>
            <tbody>
              {#each p.nudges as n (`${n.campaign}-${n.stage}`)}
                {@const a = ratio(n.sentReturned, n.sent)}
                {@const b = ratio(n.heldReturned, n.held)}
                <tr>
                  <td>{NUDGE[n.campaign] ?? n.campaign}</td>
                  <td class="num">{n.stage}</td>
                  <td class="num">{fmt(n.sent)}</td>
                  <td class="num">{fmt(a, 'pct')}</td>
                  <td class="num">{fmt(n.held)}</td>
                  <td class="num">{fmt(b, 'pct')}</td>
                  <td class="num">{a === null || b === null ? '—' : `${a >= b ? '+' : '−'}${Math.abs((a - b) * 100).toFixed(1)}%p`}</td>
                </tr>
              {/each}
            </tbody>
          </table>
          <p class="note">비교군이 작으면 차이가 흔들려요. 비교군 100명 이하 단계는 참고만 해요.</p>
        </section>
      {/if}

      <section class="panel">
        <header><h2>최근 알림</h2><span class="hint">최근 20건</span></header>
        {#if p.campaigns.length}
          <table class="tbl">
            <thead>
              <tr><th>보낸 시각</th><th>종류</th><th>제목</th><th class="num">받는 사람</th><th class="num">도달</th><th class="num">클릭률</th></tr>
            </thead>
            <tbody>
              {#each p.campaigns as c (c.id)}
                <tr>
                  <td>{kstTime(c.createdAt)}</td>
                  <td>{CATEGORY[c.category]}</td>
                  <td class="title">{c.title}</td>
                  <td class="num">{fmt(c.recipients)}</td>
                  <td class="num">{pct(c.acceptedRecipients, c.recipients)}</td>
                  <td class="num">{pct(c.clicked, c.acceptedRecipients)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {:else}
          <p class="note">기간 안 보낸 알림이 없어요.</p>
        {/if}
      </section>
      <p class="note">클릭 기록은 {kstTime(p.trackingStartedAt)}부터 있어요. 보내기 · 대상 고르기는 운영 도구에서 해요.</p>
    {/snippet}
  </Load>
</div>

<style>
  .title {
    max-width: 320px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
