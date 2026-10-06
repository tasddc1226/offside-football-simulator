<script lang="ts">
  // T-10-005 명예의 전당 이름 공개 토글. 은퇴 때는 환경설정 '선수 이름 공개'(T-10-065, 기본 켜짐)를 따른다.
  import type { HofEntry } from '@offside/game/types';
  import { setLegendPublic } from './legend.js';
  import { hofOwnText as L } from '@offside/app-core/i18n/ko/hofOwn';

  const { h }: { h: HofEntry } = $props();
  // 쓰기 가능한 derived: 다른 선수로 바뀌면 그 선수 값으로 다시 맞춰진다.
  let on = $derived(!!h.public);

  function toggle() {
    if (setLegendPublic(h, !on)) on = !on;
  }
</script>

<section class="card stack">
  <div><div class="eyebrow">Hall of Fame</div><h2>{L.publishTitle}</h2></div>
  <p class="muted fs-sm">
    {L.publishBefore} <b>{on ? L.publishNamed({ name: h.name }) : L.publishAnon}</b> {L.publishAfter}
    {#if !on}{L.publishHint}{/if}
  </p>
  <button class="btn btn-block" data-act="hof-public" aria-pressed={on} onclick={toggle}>
    {on ? L.publishRevert : L.publishOn}
  </button>
</section>
