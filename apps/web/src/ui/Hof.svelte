<script lang="ts">
  // 명예의 전당 전체 보기(하단 메뉴 '기록실') — 100명씩 페이지로 본다.
  import HallOfFame from './HallOfFame.svelte';
  import Topbar from './Topbar.svelte';
</script>

<div class="wrap">
  <Topbar />
  <HallOfFame full />
</div>
