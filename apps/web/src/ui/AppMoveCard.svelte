<script lang="ts">
  // T-11-092 설정 > iPhone 앱으로 옮기기. 앱 받기 → 같은 구글 계정 로그인(서버 기록) → 진행 중 커리어는 바로 아래 백업 코드로.
  // 안드로이드는 비공개 테스트라 보이지 않는다(홈의 테스터 모집 타일이 대신한다).
  import { APP_PROMO } from '@offside/app-core/appPromo';
  import { appTarget, openAppStore } from './appStore.js';

  const show = appTarget() !== 'android';
</script>

{#if show}
  <section class="card settings-card" data-settings="app-move">
    <div class="settings-label">
      <small class="eyebrow">iPhone app</small>
      <strong>{APP_PROMO.move.title}</strong>
    </div>
    <ol class="notice-steps app-move-steps">
      {#each APP_PROMO.move.steps as step (step)}<li>{step}</li>{/each}
    </ol>
    <button class="btn btn-primary btn-block" data-act="app-store-settings" onclick={() => openAppStore('settings')}>{APP_PROMO.sheet.store}</button>
  </section>
{/if}

<style>
  .app-move-steps {
    margin-top: 10px;
    gap: 4px;
    color: var(--muted);
    font-size: 0.875rem;
  }
</style>
