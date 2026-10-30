<script lang="ts">
  // T-10-005 명예의 전당 이름 공개 토글. 은퇴 때는 환경설정 '선수 이름 공개'(T-10-065, 기본 켜짐)를 따른다.
  // T-11-439 공개 중에도 실명 경고를 한 줄 두고(B4), 서버가 받지 않을 이름이면 누르기 전에 알리고 버튼을 막는다(B3).
  import type { HofEntry } from '@offside/game/types';
  import { canPublishName } from '@offside/app-core/namePublic';
  import { setLegendPublic } from './legend.js';
  import { hofOwnText as L } from '@offside/app-core/i18n/ko/hofOwn';

  const { h }: { h: HofEntry } = $props();
  // 쓰기 가능한 derived: 다른 선수로 바뀌면 그 선수 값으로 다시 맞춰진다.
  let on = $derived(!!h.public);
  const blocked = $derived(!on && !canPublishName(h.name));

  function toggle() {
    if (setLegendPublic(h, !on)) on = !on;
  }
</script>

<section class="card stack">
  <div><div class="eyebrow">Hall of Fame</div><h2>{L.publishTitle}</h2></div>
  <p class="muted fs-sm">
    {L.publishBefore} <b>{on ? L.publishNamed({ name: h.name }) : L.publishAnon}</b> {L.publishAfter}
    {#if !on && !blocked}{L.publishHint}{/if}
  </p>
  {#if on}<p class="fs-sm" data-publish-warn>{L.publishWarn}</p>{/if}
  {#if blocked}<p class="fs-sm" data-publish-blocked>{L.publishBlocked}</p>{/if}
  <button class="btn btn-block" data-act="hof-public" aria-pressed={on} disabled={blocked} onclick={toggle}>
    {on ? L.publishRevert : L.publishOn}
  </button>
</section>
