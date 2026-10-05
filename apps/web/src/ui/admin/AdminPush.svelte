<script lang="ts">
  import { onMount } from 'svelte';
  import type { PushPerformance, PushMetrics } from '@offside/contracts';
  import { fetchPushPerformance } from '@offside/app-core/api/admin';
  import { kstDateTime as kst } from '@offside/app-core/boardText';
  import { PUSH_CATEGORY_LABELS as labels, PUSH_METRIC_LABELS, pushClickRate, PUSH_METRICS_HELP, PUSH_TARGET_HELP, PUSH_RECEIPT_HELP } from '@offside/app-core/pushPerformance';

  let days = $state(7);
  let tests = $state(false);
  let data = $state<PushPerformance | null>(null);
  let busy = $state(false);
  let error = $state('');
  let page = $state(0);
  let revision = 0;
  onMount(() => { void load(); return () => { revision++; }; });
  async function load(fresh = false, more = false) {
    const rev = ++revision;
    busy = true; error = '';
    const next = more ? page + 1 : 0;
    const result = await fetchPushPerformance(days, tests, next, fresh, more ? data?.cohortThrough : undefined);
    if (rev !== revision) return;
    busy = false;
    if (!result.ok) { error = result.error.message; return; }
    data = more && data ? { ...result.data, campaigns: [...data.campaigns, ...result.data.campaigns] } : result.data;
    page = next;
  }
  function period(n: number) { days = n; data = null; void load(); }
  function toggleTests() { tests = !tests; data = null; void load(); }
</script>

{#snippet resultRow(m: PushMetrics, title: string, subtitle: string)}
  <details class="push-row">
    <summary>
      <span class="push-title"><strong>{title}</strong>{#if subtitle}<small class="muted">{subtitle}</small>{/if}</span>
      <span class="push-rate">클릭률 <b>{pushClickRate(m)}</b></span>
      <span class="push-line muted">접수 {m.accepted.toLocaleString()} · 전달 확인 {m.confirmed.toLocaleString()} · 클릭 {m.clicked.toLocaleString()} · 이동 {m.targetOpened.toLocaleString()}</span>
    </summary>
    <dl class="push-details">
      {#each PUSH_METRIC_LABELS as metric (metric.key)}<div><dt>{metric.label}</dt><dd>{m[metric.key].toLocaleString()}</dd></div>{/each}
      <div><dt>접수된 알림</dt><dd>{m.acceptedRecipients.toLocaleString()}</dd></div>
      <div><dt>클릭한 알림</dt><dd>{m.clicked.toLocaleString()}</dd></div>
      <div><dt>연결 화면 이동</dt><dd>{m.targetOpened.toLocaleString()}</dd></div>
    </dl>
  </details>
{/snippet}

<div class="stack push-panel" style="gap:14px" data-admin="push">
  <div class="row" style="justify-content:space-between;flex-wrap:wrap">
    <h2 style="margin:0">앱 푸시</h2>
    <button class="icon-btn" disabled={busy} onclick={() => load(true)}>{busy ? '불러오는 중…' : '새로고침'}</button>
  </div>
  <div class="seg" style="grid-template-columns:repeat(3,1fr)" role="group" aria-label="푸시 집계 기간">
    {#each [7,30,90] as n (n)}<button class="opt" aria-pressed={days === n} disabled={busy} onclick={() => period(n)}>최근 {n}일</button>{/each}
  </div>
  <button class="icon-btn self-start" aria-pressed={tests} disabled={busy} onclick={toggleTests}>테스트 푸시 {tests ? '포함' : '제외'}</button>
  {#if error}<p class="error" role="alert">{error}</p><button class="icon-btn self-start" disabled={busy} onclick={() => load(true)}>다시 시도</button>{/if}
  {#if busy && !data}<p class="muted" aria-live="polite">발송 결과를 불러오는 중…</p>{/if}
  {#if data}
    <p class="muted fs-xs">{kst(data.generatedAt)} 기준 · KST · 1분 캐시</p>
    <p class="muted fs-xs">클릭·이동은 업데이트된 앱에서 수집해요. 업데이트 전 클릭은 포함되지 않아요.</p>
    <div class="push-summary">
      <div><span>발송 접수</span><b>{data.totals.accepted.toLocaleString()}</b><small class="muted">전달 확인 {data.totals.confirmed.toLocaleString()}</small></div>
      <div><span>클릭률</span><b>{pushClickRate(data.totals)}</b><small class="muted">클릭 {data.totals.clicked.toLocaleString()} / 접수 알림 {data.totals.acceptedRecipients.toLocaleString()}</small></div>
      <div><span>연결 화면 이동</span><b>{data.totals.targetOpened.toLocaleString()}</b><small class="muted">클릭 후 24시간</small></div>
      <div><span>실패 / 결과 불명</span><b>{data.totals.failed.toLocaleString()} / {data.totals.unknown.toLocaleString()}</b><small class="muted">취소 {data.totals.cancelled.toLocaleString()} · 진행 중 {data.totals.pending.toLocaleString()}</small></div>
    </div>
    <details class="push-help"><summary>집계 기준</summary><div class="stack" style="gap:8px">
      <p>{PUSH_METRICS_HELP}</p><p>{PUSH_RECEIPT_HELP}</p><p>{PUSH_TARGET_HELP}</p>
      <p>알림 생성일을 기준으로 묶어요. 추적 시작: {kst(data.trackingStartedAt)}. 이전 발송은 남아 있는 결과만 보여요. 클릭 추적은 업데이트된 앱에서 시작돼요. 기록은 90일 보관하며, 계정을 삭제하면 함께 지워져요.</p>
    </div></details>
    <section class="stack" style="gap:8px" aria-label="종류별 푸시 성과">
      <h3>종류별 성과</h3>
      {#each data.categories as m (m.category)}{@render resultRow(m, labels[m.category], '')}{:else}<p class="muted">이 기간에 발송된 푸시가 없어요.</p>{/each}
    </section>
    {#if data.daily.length}
      <details class="push-help"><summary>일별 추이</summary>
        {#each data.daily as day (day.day)}<div class="push-day"><strong>{day.day}</strong><span>접수 {day.accepted} · 클릭 {day.clicked} · 이동 {day.targetOpened}</span></div>{/each}
      </details>
    {/if}
    <section class="stack" style="gap:8px" aria-label="발송별 푸시 결과">
      <h3>발송별 결과</h3><p class="muted fs-xs">최근 발송부터 보여요. 각 항목을 누르면 전체 결과를 볼 수 있어요.</p>
      {#each data.campaigns as m (m.id)}{@render resultRow(m, m.title, `${labels[m.category]} · ${kst(m.createdAt)}`)}{:else}<p class="muted">발송 기록이 없어요.</p>{/each}
      {#if data.hasMore}<button class="icon-btn" disabled={busy} onclick={() => load(false, true)}>더 보기</button>{/if}
    </section>
  {/if}
</div>

<style>
  .push-panel { min-width: 0; }
  .push-panel h3, .push-panel p { margin: 0; }
  .push-summary { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 10px; }
  .push-summary > div { display: flex; flex-direction: column; gap: 4px; padding: 12px; border: 1px solid var(--line); border-radius: 12px; overflow-wrap: anywhere; }
  .push-summary b { font-size: 1.4rem; font-variant-numeric: tabular-nums; }
  .push-row { border-top: 1px solid var(--line); }
  summary { cursor: pointer; min-height: 44px; padding: 12px 0; }
  summary:focus-visible { outline: 2px solid var(--ink); outline-offset: 3px; }
  .push-row summary { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 8px; }
  .push-title { display: flex; flex-direction: column; gap: 4px; overflow-wrap: anywhere; }
  .push-rate { text-align: right; font-size: .85rem; }
  .push-rate b { display: block; font-size: 1.1rem; font-variant-numeric: tabular-nums; }
  .push-line { grid-column: 1 / -1; font-size: .85rem; }
  .push-details { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 8px; margin: 0 0 12px; }
  .push-details > div, .push-day { display: flex; flex-wrap: wrap; gap: 4px 10px; justify-content: space-between; font-size: .85rem; }
  .push-details dd { margin: 0; font-variant-numeric: tabular-nums; }
  .push-help { border: 1px solid var(--line); border-radius: 10px; padding: 0 12px; font-size: .85rem; }
  .push-help > div { padding-bottom: 12px; }
  .push-day { padding: 8px 0; border-top: 1px solid var(--line); }
  @media (max-width:360px) { .push-details { grid-template-columns: 1fr; } }
</style>
