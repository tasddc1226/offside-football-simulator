<script lang="ts">
  // 자동 플레이 탐지(관찰 전용). 최근 N시간 동안 시즌을 올린 프로필 중 사람답지 않은 흐름이 보이는 곳을 점수순으로
  // 보여 준다 — 게임에는 아무 영향이 없다. 근거 기준은 api `db/repos/automation.ts`.
  import { onMount } from 'svelte';
  import type { AutomationReason } from '@offside/contracts';
  import type { LoadStatus } from '../LoadState.svelte';
  import * as api from '../../api/admin.js';
  import type { AutomationReport } from '../../api/admin.js';
  import { kstDateTime as kst } from '../boardText.js';
  import { openPublicLegendById } from '../legend.js';

  const REASON: Record<AutomationReason, string> = {
    webdriver: '자동화 브라우저',
    headless: '헤드리스 브라우저',
    synthetic: '스크립트 클릭',
    noInput: '입력 없이 진행',
    noMoves: '커서 이동 없는 클릭',
    metronome: '기계처럼 일정한 간격',
    steady: '꽤 일정한 간격',
    serial: '번호만 바꾼 연속 커리어',
    nonstop: '쉬지 않는 업로드',
    aiName: 'AI·봇 이름',
  };
  const HOURS = [1, 6, 24] as const;

  let hours = $state<(typeof HOURS)[number]>(6);
  let report = $state<AutomationReport | null>(null);
  let status = $state<LoadStatus>('loading');

  onMount(() => void load());

  async function load() {
    status = 'loading';
    const r = await api.fetchAutomation(hours);
    if (!r.ok) {
      status = 'error';
      return;
    }
    report = r.data;
    status = 'ready';
  }
  function pick(h: (typeof HOURS)[number]) {
    hours = h;
    void load();
  }
</script>

<div class="stack" style="gap:14px" data-admin="automation">
  <div class="row" style="justify-content:space-between">
    <h2 style="margin:0">자동 플레이 의심</h2>
    <button class="icon-btn" data-act="refresh-automation" onclick={load}>새로고침</button>
  </div>
  <div class="seg three" role="group" aria-label="조회 구간">
    {#each HOURS as h (h)}
      <button class="opt" aria-pressed={hours === h} data-automation-hours={h} onclick={() => pick(h)}>최근 {h}시간</button>
    {/each}
  </div>
  <p class="muted fs-xs" style="margin:0">
    관찰 전용이에요 — 게임에는 영향이 없어요. 사람도 같은 속도로 누르면 간격이 일정하게 나올 수 있으니 근거를 함께 보고 판단해 주세요.
    조작 요약(브라우저·클릭·커서)은 이번 업데이트 뒤에 올라온 시즌부터 있어요.
  </p>
  {#if status === 'loading'}
    <p class="muted" aria-live="polite">불러오는 중…</p>
  {:else if status === 'error' || !report}
    <div class="stack" style="gap:8px">
      <p class="muted" style="margin:0">불러오지 못했어요.</p>
      <button class="icon-btn self-start" onclick={load}>다시 시도</button>
    </div>
  {:else}
    {@const r = report}
    <p class="fs-sm" style="margin:0" data-automation-summary>
      {kst(r.generatedAt)} 기준 · 최근 {r.hours}시간 동안 시즌을 올린 <b>{r.profiles.toLocaleString()}</b>개 프로필 중
      <b>{r.suspects.length}</b>곳
    </p>
    <ul class="bots">
      {#each r.suspects as s (s.profile)}
        <li class="bot" data-suspect={s.profile} data-level={s.level}>
          <div class="row" style="justify-content:space-between;gap:8px">
            <b>
              <span class="lvl {s.level}">{s.level === 'high' ? '높음' : '보통'}</span>
              프로필 {s.profile}
            </b>
            <span class="muted fs-xs">점수 {s.score}</span>
          </div>
          <div class="chips">
            {#each s.reasons as why (why)}<span class="chip" data-reason={why}>{REASON[why]}</span>{/each}
          </div>
          <p class="muted fs-xs" style="margin:0">
            시즌 {s.seasons} · 활동 {s.activeHours}시간대 · {kst(s.firstAt)} – {kst(s.lastAt)}
          </p>
          <ul class="bot-careers">
            {#each s.careers as c (c.careerId)}
              <li>
                <span>
                  {c.name ?? '익명'}
                  <small class="muted">
                    {c.status === 'retired' ? '은퇴' : '진행'} · {c.seasons}시즌{c.medianGapSec !== null ? ` · 간격 ${c.medianGapSec}초` : ''}{c.cv !== null ? ` · 변동 ${c.cv}` : ''}
                  </small>
                </span>
                {#if c.status === 'retired'}
                  <button class="icon-btn" onclick={() => openPublicLegendById(c.careerId)}>기록</button>
                {/if}
              </li>
            {/each}
          </ul>
        </li>
      {:else}
        <li class="muted">의심되는 흐름이 없어요.</li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .bots,
  .bot-careers { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
  .bots { gap: 10px; }
  .bot { border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; }
  .lvl { display: inline-block; font-size: 0.75rem; padding: 1px 8px; border-radius: 999px; margin-right: 4px; }
  .lvl.high { background: var(--bad); color: #fff; }
  .lvl.medium { background: var(--line); }
  .chips { display: flex; flex-wrap: wrap; gap: 4px; }
  .chip { font-size: 0.75rem; border: 1px solid var(--line); border-radius: 999px; padding: 1px 8px; }
  .bot-careers li { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 4px 0; border-top: 1px solid var(--line); font-size: 0.8125rem; }
  .bot-careers small { display: block; }
</style>
