<script lang="ts">
  // T-11-145 편성 화면의 컵 명단 띠 — 컵에 참가 중이면 마감 시각을, 잠긴 동안은 잠겼다는 안내를 보여 준다. 서버가 저장을 막으므로
  // 여기서는 안내만 한다.
  import { cupText as L } from '@offside/app-core/i18n/ko/cup';

  let { locked, when }: { locked: boolean; when: string | null } = $props();
</script>

<section class="card cup-band" class:locked role="status" data-cup-lineup={locked ? 'locked' : 'open'}>
  <b class="cb-title">{L.title}</b>
  <p>{locked ? L.lineupLocked : when ? L.lineupBand({ when }) : ''}</p>
</section>

<style>
  .cup-band {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 12px 16px;
    border-left: 4px solid var(--good);
  }
  .cup-band.locked {
    border-left-color: var(--warn);
  }
  .cb-title {
    font-size: 0.8125rem;
  }
  .cup-band p {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--muted);
    overflow-wrap: anywhere;
  }
</style>
