<script lang="ts">
  // ui.ts render()의 화면 라우팅 포트 (148~153줄)
  import { fly } from 'svelte/transition';
  import { appState } from './state.svelte.js';
  import { dur } from './motion.js';
  import Home from './Home.svelte';
  import Create from './Create.svelte';
  import Game from './Game.svelte';
  import Retired from './Retired.svelte';
  import Legend from './Legend.svelte';
  import Hof from './Hof.svelte';
  import UpdateBanner from './UpdateBanner.svelte';
  import type { Component } from 'svelte';

  // T-10-009: 설정(클럽 편집)은 자주 안 여는 화면이라 메인 번들에서 떼어 처음 열 때 불러온다.
  let Settings = $state<Component<Record<string, never>> | null>(null);
  $effect(() => {
    if (appState.screen === 'settings' && !Settings) void import('./Settings.svelte').then((m) => (Settings = m.default));
  });
  // T-10-012: 확률 도감도 처음 열 때 불러온다(확률 분석 코드 포함).
  let Dex = $state<Component<Record<string, never>> | null>(null);
  $effect(() => {
    if (appState.screen === 'dex' && !Dex) void import('./EventDex.svelte').then((m) => (Dex = m.default));
  });
  // T-10-011: 소식(게시판)도 같은 방식으로 처음 열 때 불러온다.
  let Board = $state<Component<Record<string, never>> | null>(null);
  $effect(() => {
    if (appState.screen === 'board' && !Board) void import('./Board.svelte').then((m) => (Board = m.default));
  });
  // T-10-016: 운영 도구(관리자 전용).
  let Admin = $state<Component<Record<string, never>> | null>(null);
  $effect(() => {
    if (appState.screen === 'admin' && !Admin) void import('./Admin.svelte').then((m) => (Admin = m.default));
  });
</script>

<!-- 화면 전환 모션(T-10-003 goal 3): appState.screen을 key로 써서 화면이 바뀔 때만 새로 마운트해
     in/out 트랜지션이 걸리게 한다. opacity는 고정(1)해 transform(y)만 움직인다 — 전환 중에도 텍스트
     명도 대비가 최종 값과 같아서(axe color-contrast가 중간 프레임을 스냅샷해도 값이 흔들리지
     않는다) e2e/a11y 타이밍에 안전하다. 래퍼 div는 transform만 건드리므로 그 안의 position:fixed
     요소(탭바·액션바·시트)는 뷰포트 기준 위치를 그대로 유지한다. 감속 모션이면 duration 0.
     T-10-004: 래퍼를 <main> 랜드마크로 둬 모든 화면 콘텐츠가 랜드마크 안에 들어가게 한다(axe region). -->
{#key appState.screen}
  <main in:fly={{ y: 10, duration: dur(180), opacity: 1 }}>
    {#if appState.screen === 'home'}
      <Home />
    {:else if appState.screen === 'create'}
      <Create />
    {:else if appState.screen === 'retired'}
      <Retired />
    {:else if appState.screen === 'legend'}
      <Legend />
    {:else if appState.screen === 'hof'}
      <Hof />
    {:else if appState.screen === 'settings'}
      {#if Settings}<Settings />{/if}
    {:else if appState.screen === 'dex'}
      {#if Dex}<Dex />{/if}
    {:else if appState.screen === 'board'}
      {#if Board}<Board />{/if}
    {:else if appState.screen === 'admin'}
      {#if Admin}<Admin />{/if}
    {:else}
      <Game />
    {/if}
  </main>
{/key}
<UpdateBanner />
