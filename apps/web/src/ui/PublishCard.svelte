<script lang="ts">
  // T-10-005 이름 공개 옵트인. 기본은 익명 — 유저가 켜야만 선수 이름이 전체 명예의 전당에 보인다.
  import type { HofEntry } from '../game/types.js';
  import { setLegendPublic } from './legend.js';

  const { h }: { h: HofEntry } = $props();
  // 쓰기 가능한 derived: 다른 선수로 바뀌면 그 선수 값으로 다시 맞춰진다.
  let on = $derived(!!h.public);

  function toggle() {
    if (setLegendPublic(h, !on)) on = !on;
  }
</script>

<section class="card stack">
  <div><div class="eyebrow">Hall of Fame</div><h2>전체 명예의 전당 이름 공개</h2></div>
  <p class="muted" style="font-size:13px">
    은퇴 기록은 모든 유저가 보는 명예의 전당에 올라갑니다. 지금은 <b>{on ? `"${h.name}" 이름으로` : '익명으로'}</b> 표시됩니다.
    {#if !on}이름을 공개하면 다른 유저에게 선수 이름이 보입니다. 실명은 쓰지 않는 것을 권장합니다.{/if}
  </p>
  <button class="btn btn-block" data-act="hof-public" aria-pressed={on} onclick={toggle}>
    {on ? '익명으로 되돌리기' : '이름 공개하기'}
  </button>
</section>
