<script lang="ts">
  // ui.ts render()의 화면 라우팅 포트 (148~153줄)
  import { appState } from './state.svelte.js';
  import Home from './Home.svelte';
  import Create from './Create.svelte';
  import Game from './Game.svelte';
  import Retired from './Retired.svelte';
</script>

{#if appState.screen === 'home'}
  <Home />
{:else if appState.screen === 'create'}
  <Create />
{:else if appState.screen === 'retired'}
  <Retired />
{:else}
  <Game />
{/if}
