<script lang="ts">
  // T-10-023: 새 배포가 감지되면 화면 위에 새로고침 안내를 띄운다.
  import { fly } from 'svelte/transition';
  import { updateState } from './update.svelte.js';
  import { dur } from './motion.js';
</script>

{#if updateState.ready}
  <aside class="update-banner" aria-label="업데이트 알림" transition:fly={{ y: -16, duration: dur(200) }}>
    <span>새 버전이 나왔어요. 새로고침하면 바로 적용돼요.</span>
    <button class="btn btn-accent" data-act="reload" onclick={() => location.reload()}>새로고침</button>
  </aside>
{/if}
