<script lang="ts">
  // T-11-330 선수 플레이의 시트(Sheet.svelte)와 같은 모양으로 아래에서 올라오는 창. 선수 시트는 게임 진행(sheetState)에
  // 묶여 있어서, 감독 커리어처럼 화면이 직접 내용을 그리는 곳은 이 틀만 쓴다. 고르거나 다음으로 넘어가야 닫히는 창이라
  // 배경 누르기 · 끌어 내리기로 닫지 않는다. step이 바뀌면(다음 이벤트 등) 맨 위로 올리고 첫 버튼에 초점을 둔다.
  // 올라올 때만 움직인다 — 닫히는 동안 지난 단계 버튼이 남아 눌리지 않게 닫힐 때는 바로 없앤다.
  // T-11-344 onclose를 주면(채팅 사용자 창처럼 골라도 그만인 창) 배경 누르기 · Esc로 닫는다.
  import type { Snippet } from 'svelte';
  import { fly } from 'svelte/transition';
  import { dur } from './motion.js';
  import { lockScroll } from './scrollLock.js';

  let {
    label,
    step = '',
    onclose,
    children,
  }: { label: string; step?: string; onclose?: () => void; children: Snippet } = $props();
  let el = $state<HTMLDivElement | null>(null);
  let shown = $state(false);

  $effect(() => {
    // 다음 프레임에 붙여야 배경이 0 → 1로 서서히 나타난다(Sheet.svelte와 같다).
    const id = requestAnimationFrame(() => (shown = true));
    const unlock = lockScroll();
    return () => {
      cancelAnimationFrame(id);
      unlock();
    };
  });
  $effect(() => {
    void step;
    if (!el) return;
    el.scrollTop = 0;
    el.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
  });
</script>

<svelte:window onkeydown={(e) => { if (onclose && e.key === 'Escape') onclose(); }} />
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="modal" class:modal-in={shown} onclick={(e) => { if (onclose && e.target === e.currentTarget) onclose(); }}>
  <div class="sheet" role="dialog" aria-modal="true" aria-label={label} tabindex="-1" bind:this={el} in:fly={{ y: 60, duration: dur(220) }}>
    <div class="sheet-handle" aria-hidden="true"></div>
    {@render children()}
  </div>
</div>
