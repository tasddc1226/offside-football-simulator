<script lang="ts">
  // T-11-092 설정 > 앱으로 옮기기. 앱 받기 → 같은 구글 계정 로그인(서버 기록) → 진행 중 커리어는 바로 아래 백업 코드로.
  // T-11-095 기기에 맞는 스토어 하나(PC는 App Store · Google Play 둘 다).
  import { APP_PROMO } from '@offside/app-core/appPromo';
  import { appStoresFor, openAppStore } from './appStore.js';

  const oses = appStoresFor();
  const move = APP_PROMO.move(oses);
</script>

<section class="card settings-card" data-settings="app-move">
  <div class="settings-label">
    <small class="eyebrow">App</small>
    <strong>{move.title}</strong>
  </div>
  <ol class="notice-steps app-move-steps">
    {#each move.steps as step (step)}<li>{step}</li>{/each}
  </ol>
  <div class="app-move-stores">
    {#each oses as os (os)}
      <button class="btn btn-primary btn-block" data-act="app-store-settings-{os}" onclick={() => openAppStore(os, 'settings')}>{APP_PROMO.getApp(os)}</button>
    {/each}
  </div>
</section>

<style>
  .app-move-steps {
    margin-top: 10px;
    gap: 4px;
    color: var(--muted);
    font-size: 0.875rem;
  }
  .app-move-stores {
    display: grid;
    gap: 8px;
  }
</style>
