<script lang="ts">
  // T-11-031 하단 메뉴 바뀜 안내 — 게임·내 팀 하단 메뉴를 처음 볼 때 한 번만, 가운데 나가기 버튼 위에 말풍선을 띄운다
  // (문구·한 번만 판정은 app-core navIntro). 메뉴가 올라오는 모션 뒤에 뜨고, 잠시 뒤나 화면을 만지면 닫힌다.
  // 터치는 그대로 아래로 통과하고(pointer-events: none), 메뉴 자체가 aria-label로 읽히니 화면 읽기에서는 숨긴다.
  import { onDestroy } from 'svelte';
  import { fly } from 'svelte/transition';
  import { NAV_INTRO_MS, takeNavIntro, type SubNav } from '@offside/app-core/navIntro';
  import { dur } from './motion.js';
  import { sheetState } from './sheetState.svelte.js';

  const { kind }: { kind: SubNav } = $props();
  let text = $state<string | null>(null);
  let done = false;
  let hide: ReturnType<typeof setTimeout> | undefined;
  const evs = ['pointerdown', 'keydown', 'wheel'] as const;
  function close() {
    clearTimeout(hide);
    text = null;
    for (const e of evs) removeEventListener(e, close, true);
  }
  // 들어오자마자 시트(홈 화면 추가 안내·대기 중 이벤트 등)가 덮고 있으면 닫힐 때까지 미뤘다가 띄운다 — 가려진 채 '봤다'로 남지 않게.
  $effect(() => {
    if (sheetState.open || done) return;
    const show = setTimeout(() => {
      done = true;
      const t = takeNavIntro(kind);
      if (!t) return;
      text = t;
      for (const e of evs) addEventListener(e, close, { capture: true, passive: true });
      hide = setTimeout(close, NAV_INTRO_MS);
    }, dur(360));
    return () => clearTimeout(show);
  });
  onDestroy(close);
</script>

{#if text}
  <p class="nav-intro" aria-hidden="true" data-nav-intro={kind} transition:fly={{ y: 6, duration: dur(180) }}>{text}</p>
{/if}
