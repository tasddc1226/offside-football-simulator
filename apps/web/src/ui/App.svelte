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
    {:else}
      <Game />
    {/if}
  </main>
{/key}
