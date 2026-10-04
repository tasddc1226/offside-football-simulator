<script lang="ts">
  // T-10-005 명예의 전당 이름 공개 토글. 은퇴 때는 환경설정 '선수 이름 공개'(T-10-065, 기본 켜짐)를 따른다.
  import type { HofEntry } from '@offside/game/types';
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
  <p class="muted fs-sm">
    은퇴 기록은 모든 유저가 보는 명예의 전당에 올라가요. 지금은 <b>{on ? `"${h.name}" 이름으로` : '익명으로'}</b> 표시돼요.
    {#if !on}이름을 공개하면 다른 유저에게 선수 이름이 보여요. 실명은 쓰지 않는 게 좋아요.{/if}
  </p>
  <button class="btn btn-block" data-act="hof-public" aria-pressed={on} onclick={toggle}>
    {on ? '익명으로 되돌리기' : '이름 공개하기'}
  </button>
</section>
