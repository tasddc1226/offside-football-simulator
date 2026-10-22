<script lang="ts">
  // T-11-437 커리어를 시작하면 게임 화면에 한 번, 기록이 이 브라우저에만 있다는 것과 백업 코드 자리를 알린다(앱 game/SaveHint.tsx).
  // 첫 시즌에만 뜨고, 닫으면 이 기기에서 다시 뜨지 않는다(app-core firstGuide 'save').
  import { closeGuide, saveHintOpen } from '@offside/app-core/firstGuide';
  import { firstGuideText as L } from '@offside/app-core/i18n/ko/firstGuide';
  import { goBackup } from './nav.js';

  const { pastSeasons }: { pastSeasons: number } = $props();
  let open = $state(saveHintOpen(pastSeasons));
  function close() {
    closeGuide('save');
    open = false;
  }
</script>

{#if open}
  <section class="card save-hint" data-save-hint>
    <div class="sh-text">
      <b>{L.saveTitleWeb}</b>
      <p class="muted fs-sm">{L.saveBodyWeb}</p>
      <button class="btn btn-sm" data-act="save-hint-backup" onclick={() => (closeGuide('save'), goBackup())}>{L.saveGo}</button>
    </div>
    <button class="icon-btn" data-act="save-hint-close" aria-label={L.saveCloseAria} onclick={close}>{L.close}</button>
  </section>
{/if}

<style>
  .save-hint { display: flex; align-items: flex-start; gap: 12px; margin-top: 12px; border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent); }
  .sh-text { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }
  .sh-text p { margin: 0; overflow-wrap: anywhere; }
  .icon-btn { flex: none; }
</style>
