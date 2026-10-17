<script lang="ts">
  // T-11-354 설정의 '지난 커리어 정리'(앱 screens/settings/CareerCleanup.tsx). 찾기를 눌렀을 때만 서버에 묻고,
  // 확인을 받으면 정리한다. 이 기기의 진행 중 커리어와 올리지 못한 업로드는 빼 달라고 보낸다(app-core careerCleanup).
  import { cleanupKeep, clearStaleCareers, findStaleCareers, type CleanupFind } from '@offside/app-core/careerCleanup';
  import { careerCleanupText as L } from '@offside/app-core/i18n/ko/careerCleanup';
  import { num } from '@offside/app-core/teamText';
  import { appState } from './state.svelte.js';
  import { toast } from './helpers.js';

  let view = $state<CleanupFind | 'finding' | 'clearing' | null>(null);
  let note = $state('');

  async function find() {
    view = 'finding';
    note = '';
    view = await findStaleCareers(cleanupKeep(appState.G));
  }

  async function clear() {
    if (typeof view !== 'object' || view?.kind !== 'found') return;
    if (!confirm(L.confirm({ n: num(view.count) }))) return;
    view = 'clearing';
    const r = await clearStaleCareers(cleanupKeep(appState.G));
    note = r.ok ? L.done({ n: num(r.cleared) }) : L.clearError({ n: num(r.cleared) });
    toast(note);
    view = r.ok ? { kind: 'none' } : { kind: 'error' };
  }
</script>

<section class="card settings-card" data-settings="career-cleanup">
  <div class="settings-label">
    <small class="eyebrow">Careers</small>
    <strong>{L.title}</strong>
    <span class="muted">{L.body}</span>
  </div>
  <div class="cleanup-body" aria-live="polite">
    {#if view === 'finding' || view === 'clearing'}
      <p class="muted fs-sm">{view === 'finding' ? L.finding : L.clearing}</p>
    {:else if view?.kind === 'found'}
      <p class="fs-sm" data-cleanup="found">{L.found({ n: num(view.count) })}</p>
      <button class="btn btn-sm" data-act="cleanup-clear" onclick={clear}>{L.clear({ n: num(view.count) })}</button>
    {:else}
      {#if note}<p class="muted fs-sm" data-cleanup="done">{note}</p>
      {:else if view?.kind === 'none'}<p class="muted fs-sm" data-cleanup="none">{L.none}</p>
      {:else if view?.kind === 'error'}<p class="muted fs-sm" data-cleanup="error">{L.error}</p>{/if}
      <button class="btn btn-sm" data-act="cleanup-find" onclick={find}>{L.find}</button>
    {/if}
  </div>
</section>

<style>
  .cleanup-body {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    margin-top: 12px;
  }
  .cleanup-body p {
    margin: 0;
  }
</style>
