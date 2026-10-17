<script lang="ts">
  // T-11-355 처음 안내 카드 — 포지션·유형, 스카우트권 위치, 영구결번처럼 자주 묻는 길찾기를 홈에서 한 번 알려 준다.
  // 기기마다 닫을 때까지(app-core firstGuide). 홈 첫 화면 번들에 둔다(늦게 그리면 홈이 밀린다).
  import { FOCUS_PICK } from '@offside/game/data';
  import { closeGuide, guideOpen } from '@offside/app-core/firstGuide';
  import { firstGuideText as L } from '@offside/app-core/i18n/ko/firstGuide';
  import { goRerollShop, goTypeDex } from './nav.js';

  let open = $state(guideOpen('home'));
  function close() {
    closeGuide('home');
    open = false;
  }
</script>

{#if open}
  <section class="card first-guide stack" data-first-guide aria-labelledby="first-guide-title">
    <div class="fg-head">
      <div>
        <small class="eyebrow">Start here</small>
        <h2 id="first-guide-title">{L.title}</h2>
      </div>
      <button class="icon-btn" data-act="first-guide-close" aria-label={L.closeAria} onclick={close}>{L.close}</button>
    </div>
    <div class="fg-row">
      <b>{L.typesTitle}</b>
      <p class="muted fs-sm">{L.typesBody({ n: FOCUS_PICK })}</p>
      <button class="btn btn-sm" data-act="first-guide-types" onclick={goTypeDex}>{L.typesGo}</button>
    </div>
    <div class="fg-row">
      <b>{L.shopTitle}</b>
      <p class="muted fs-sm">{L.shopBody}</p>
      <button class="btn btn-sm" data-act="first-guide-shop" onclick={goRerollShop}>{L.shopGo}</button>
    </div>
    <div class="fg-row">
      <b>{L.guideTitle}</b>
      <p class="muted fs-sm">{L.guideBody}</p>
      <a class="btn btn-sm" data-act="first-guide-guide" href="/guide/">{L.guideGo}</a>
    </div>
  </section>
{/if}

<style>
  .first-guide { gap: 12px; }
  .fg-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  .fg-head h2 { margin: 2px 0 0; }
  .fg-row { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; padding-top: 10px; border-top: 1px solid var(--line); }
  .fg-row p { margin: 0; overflow-wrap: anywhere; }
</style>
