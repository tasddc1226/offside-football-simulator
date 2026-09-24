<script lang="ts">
  // ui.ts renderHome() 포트 (156~182줄)
  import { PHASES, LAST_PHASE, POS } from '../game/data.js';
  import { ovr } from '../game/attributes.js';
  import { loadHOF } from '../game/season.js';
  import { appState } from './state.svelte.js';
  import { goNew, goContinue } from './actions.js';
  import Topbar from './Topbar.svelte';
  import type { Component } from 'svelte';

  const live = $derived(!!appState.G && !appState.G.retired);
  const hof = loadHOF();

  // ui.ts의 mountAccount()처럼 계정 패널은 메인 청크와 분리된 동적 import로 불러온다(원본 주석:
  // account.ts는 게임 로직과 무관한 로그인 UI라 초기 번들에서 제외한다).
  let Account = $state<Component<Record<string, never>> | null>(null);
  void import('./Account.svelte').then((m) => (Account = m.default));
</script>

<div class="wrap">
  <Topbar />
  <section class="hero-home">
    <div class="chalk"></div>
    <div class="eyebrow">Kick-off · 0′</div>
    <h1>당신의 90분이<br />지금 시작됩니다</h1>
    <p>고교 3학년의 킥오프부터 은퇴의 종료 휘슬까지. 선택과 확률이 한 선수의 커리어를 만듭니다.</p>
    <button class="btn btn-accent btn-block" data-act="new" onclick={goNew}>새 커리어 킥오프 →</button>
  </section>
  {#if live && appState.G}
    <button class="tile" data-act="continue" style="width:100%" onclick={goContinue}>
      <span class="eyebrow">Continue</span><b>{appState.G.name} · {appState.G.age}세 · {appState.G.club.name}</b>
      <span class="muted" style="font-size:13px">{appState.G.year} 시즌 {PHASES[Math.min(appState.G.phase, LAST_PHASE + 1)]} · OVR {ovr(appState.G)}</span>
    </button>
  {/if}
  <div class="tiles">
    <div class="tile"><span class="eyebrow">How to play</span><b>구간마다 훈련 선택</b><span class="muted" style="font-size:13px">한 시즌 = 프리시즌 + 전반기 + 후반기</span></div>
    <div class="tile"><span class="eyebrow">Events</span><b>확률 이벤트</b><span class="muted" style="font-size:13px">선택지마다 성공 확률 공개</span></div>
  </div>
  <section class="card">
    <div class="eyebrow">Legends</div>
    <h2 style="margin-bottom:8px">명예의 전당</h2>
    {#if hof.length}
      {#each hof.slice(0, 10) as h, i (h.name + i)}
        <div class="hof-row">
          <div class="hof-rank">{i + 1}</div>
          <div>
            <b>{h.name}</b> <span class="pill">{POS[h.pos].label}</span>
            <div class="muted" style="font-size:12px">{h.apps}경기 {h.goals}골 {h.assists}도움 · 트로피 {h.trophies} · 최고 OVR {h.peak}{h.ballon ? ` · 발롱도르 ${h.ballon}회` : ''}</div>
          </div>
          <div class="num" style="font-size:22px;font-weight:700">{h.score}</div>
        </div>
      {/each}
    {:else}
      <p class="empty">아직 은퇴한 선수가 없습니다. 첫 번째 레전드가 되어보세요.</p>
    {/if}
  </section>
  <section class="card" id="account-slot">
    {#if Account}
      <Account />
    {/if}
  </section>
</div>
