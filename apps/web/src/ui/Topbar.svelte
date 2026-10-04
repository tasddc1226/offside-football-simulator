<script lang="ts">
  // ui.ts topbar() 함수(144~147줄) 포트.
  import BgmToggle from './BgmToggle.svelte';
  import { hasBgm } from './bgm.svelte.js';
  import { appState } from './state.svelte.js';
  const { sticky = false }: { sticky?: boolean } = $props();
</script>

<header class="topbar" class:sticky>
  <!-- T-11-073 라이트·다크 아이콘 중 지금 테마의 것만 보인다(style.css .badge). -->
  <img class="badge on-light" src="/brand/offside-icon-v7-64.png" alt="" width="38" height="38" />
  <img class="badge on-dark" src="/brand/offside-icon-v7-dark-64.png" alt="" width="38" height="38" />
  <div class="brand"><small>풀타임: 휘슬이 울릴 때까지</small><b>오프사이드</b></div>
  <div class="spacer"></div>
  <!-- 배경음악 스위치는 음악을 트는 화면에만(bgm.svelte.ts). -->
  {#if hasBgm(appState.screen)}<BgmToggle />{/if}
</header>
