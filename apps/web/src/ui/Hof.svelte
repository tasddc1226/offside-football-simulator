<script lang="ts">
  // 명예의 전당 전체 보기 — 홈의 TOP 3에서 '전체 보기'로 들어와 100명씩 페이지로 본다.
  import { goHome } from './actions.js';
  import HallOfFame from './HallOfFame.svelte';
  import Topbar from './Topbar.svelte';
</script>

<div class="wrap">
  <Topbar>
    {#snippet right()}
      <button class="icon-btn" data-act="home" onclick={goHome}>← 홈</button>
    {/snippet}
  </Topbar>
  <HallOfFame full />
</div>
