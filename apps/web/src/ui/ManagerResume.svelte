<script lang="ts">
  // T-11-338 진행 중인 감독 커리어 이어 하기(홈 · 내 구단 맨 위). 기기 세이브만 읽고 서버는 부르지 않는다. 홈에서는 첫 화면
  // 번들 밖 지연 청크로 불러온다. 세이브가 없으면 아무것도 그리지 않는다.
  import { managerResume } from '@offside/app-core/managerResume';
  import { managerText as MG } from '@offside/app-core/i18n/ko/manager';
  import { tn } from '@offside/game/i18n/names';
  import { go } from './nav.js';

  const r = managerResume();
  const line = $derived(
    !r ? '' : r.done ? MG.resumeDone : r.club ? MG.resumeLine({ club: tn(r.club), n: r.n, total: r.total }) : MG.resumeOffers({ n: r.n, total: r.total }),
  );
</script>

{#if r}
  <section class="card mg-resume" data-manager-resume aria-label={MG.resumeTitle}>
    <div class="mg-resume-text">
      <span class="eyebrow">{MG.resumeEyebrow}</span>
      <b class="mg-resume-title">{MG.resumeTitle}</b>
      <span class="muted fs-sm">{#if r.name}<b class="mg-resume-name">{r.name}</b> · {/if}{line}</span>
    </div>
    <span class="tap-go" aria-hidden="true">›</span>
    <button class="tap-cover" data-act="manager-resume" aria-label={MG.resumeAria({ name: r.name ?? MG.resumeNoName })} onclick={() => go('manager')}></button>
  </section>
{/if}

<style>
  .mg-resume {
    position: relative;
    display: flex;
    align-items: center;
    gap: 12px;
    border: 1px solid var(--accent);
  }
  .mg-resume-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .mg-resume-title {
    font-size: 1.0625rem;
  }
  .mg-resume-name {
    color: var(--ink);
  }
</style>
