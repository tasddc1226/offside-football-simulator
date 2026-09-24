<script lang="ts">
  // ui.ts topbar() 함수(144~147줄) 포트. 오른쪽 슬롯만 컴포넌트 children으로 받는다.
  import type { Snippet } from 'svelte';
  const { right }: { right?: Snippet } = $props();
</script>

<header class="topbar">
  <img class="badge" src="/brand/offside-flag-v6-64.png" alt="" width="38" height="38" />
  <div class="brand"><small>풀타임: 휘슬이 울릴 때까지</small><b>오프사이드</b></div>
  <div class="spacer"></div>
  {@render right?.()}
</header>
