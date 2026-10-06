<script lang="ts">
  // T-10-023: 새 배포가 감지되면 화면 위에 새로고침 안내를 띄운다.
  import { fly } from 'svelte/transition';
  import { updateState } from './update.svelte.js';
  import { dur } from './motion.js';
  import { shellText as L } from '@offside/app-core/i18n/ko/shell';
</script>

{#if updateState.ready}
  <aside class="update-banner" aria-label={L.updateAlert} transition:fly={{ y: -16, duration: dur(200) }}>
    <span>{L.updateBodyWeb}</span>
    <button class="btn btn-accent btn-sm" data-act="reload" onclick={() => location.reload()}>{L.updateBtnWeb}</button>
  </aside>
{/if}
