<script lang="ts">
  // 게임 화면 상단의 배경음악 스위치(설정 화면의 '배경음악'과 같은 값).
  import { bgm, setBgm } from './bgm.svelte.js';
  import { shellText as L } from '@offside/app-core/i18n/ko/shell';
</script>

<button
  class="icon-btn bgm-toggle"
  role="switch"
  aria-checked={bgm.on}
  aria-label={L.bgm}
  title={bgm.on ? L.bgmOff : L.bgmOn}
  data-act="bgm"
  onclick={() => setBgm(!bgm.on)}
>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M11 5 6 9H3v6h3l5 4Z" />
    {#if bgm.on}
      <path class="bgm-wave" d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path class="bgm-wave bgm-wave-2" d="M18.5 5.5a9 9 0 0 1 0 13" />
    {:else}
      <path d="m16 9 5 6" />
      <path d="m21 9-5 6" />
    {/if}
  </svg>
</button>
