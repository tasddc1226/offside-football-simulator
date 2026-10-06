<script lang="ts">
  // T-11-128 결산 카드 흐름 — 키운 선수 카드가 왼쪽에서 오른쪽으로 끝없이 흐른다. 손가락 · 마우스로 넘기면 멈췄다가
  // 잠시 뒤 다시 흐른다. 끝없이 보이도록 카드를 두 번 이어 붙이고(두 번째 줄은 화면 읽기에서 숨긴다), 반 바퀴마다
  // 위치를 되돌린다. 화면 밖이거나 움직임 줄이기면 흐르지 않고 그냥 가로로 넘겨 본다.
  import { onMount } from 'svelte';
  import type { RecapSquadMember } from '@offside/contracts';
  import { detailPosOf } from '@offside/contracts/positions';
  import { anonName } from '@offside/app-core/format';
  import { seasonRecapText as L } from '@offside/app-core/i18n/ko/seasonRecap';
  import PlayerCard from '../team/PlayerCard.svelte';
  import { motionOK } from '../motion.js';

  const { squad }: { squad: readonly RecapSquadMember[] } = $props();
  /** 1초에 움직이는 px. */
  const SPEED = 28;
  /** 손을 뗀 뒤 다시 흐르기까지(ms). */
  const RESUME = 2500;

  let el: HTMLDivElement;
  // 카드가 화면 너비를 못 채우면 이어 붙일 필요도, 흐를 필요도 없다.
  let loop = $state(false);
  const nameOf = (m: RecapSquadMember) => m.card.publicName ?? anonName(m.card.pos, m.card.number);

  onMount(() => {
    const reduce = !motionOK;
    let raf = 0;
    let last = 0;
    let pos = 0;
    let holdUntil = 0;
    let visible = false;
    // 한 벌 폭 — 크기가 바뀔 때만 다시 잰다(스크롤 · 프레임마다 레이아웃을 읽지 않는다).
    let half = 0;
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      const dt = last ? Math.min(64, t - last) : 0;
      last = t;
      if (t < holdUntil) return;
      // 왼쪽에서 오른쪽으로 흐르게 스크롤을 줄인다(0에 닿으면 반 바퀴 뒤로).
      pos -= (SPEED * dt) / 1000;
      if (pos <= 0) pos += half;
      el.scrollLeft = pos;
    };
    // 흐를 때(이어 붙였고 화면 안)만 프레임을 돈다.
    const sync = () => {
      const run = loop && visible;
      if (run && !raf) {
        last = 0;
        raf = requestAnimationFrame(tick);
      } else if (!run && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
    const measure = () => {
      // 한 벌(이어 붙이기 전) 너비가 화면보다 넓을 때만 흐른다.
      const one = loop ? el.scrollWidth / 2 : el.scrollWidth;
      const was = loop;
      loop = !reduce && one > el.clientWidth + 8;
      half = one;
      // 처음 이어 붙이면 반 바퀴 지점에서 시작해 왼쪽 끝에 바로 닿지 않게 한다.
      if (loop && !was) requestAnimationFrame(() => (pos = el.scrollLeft = half));
      sync();
    };
    const hold = () => (holdUntil = performance.now() + RESUME);
    const onScroll = () => {
      // 손으로 넘긴 위치를 이어받고, 양 끝에 닿으면 반 바퀴 되돌려 끝없이 넘긴다.
      if (Math.abs(el.scrollLeft - pos) > 2) {
        hold();
        pos = el.scrollLeft;
      }
      if (!loop) return;
      if (el.scrollLeft <= 0) pos = el.scrollLeft = half;
      else if (el.scrollLeft >= half * 2 - el.clientWidth - 1) pos = el.scrollLeft = el.scrollLeft - half;
    };
    const io = new IntersectionObserver(([e]) => {
      visible = !!e?.isIntersecting;
      sync();
    });
    const ro = new ResizeObserver(measure);
    io.observe(el);
    ro.observe(el);
    el.addEventListener('scroll', onScroll, { passive: true });
    el.addEventListener('pointerdown', hold);
    el.addEventListener('wheel', hold, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('pointerdown', hold);
      el.removeEventListener('wheel', hold);
    };
  });
</script>

{#snippet cards(copy: boolean)}
  {#each squad as m (m.card.careerId)}
    <li class="reel-card" data-recap-reel-card={copy ? undefined : m.card.careerId}>
      <PlayerCard player={m.card} name={nameOf(m)} rating={m.card.peak} role={detailPosOf(m.card)} season={m.card.season} />
    </li>
  {/each}
{/snippet}

<!-- 가로로 넘기는 영역이라 키보드(좌우 화살표)로도 넘길 수 있게 초점을 받는다. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div class="reel" bind:this={el} role="region" aria-label={L.reelAria} tabindex="0" data-recap-reel>
  <ul class="reel-track">
    {@render cards(false)}
  </ul>
  {#if loop}
    <ul class="reel-track" aria-hidden="true" inert>
      {@render cards(true)}
    </ul>
  {/if}
</div>

<style>
  .reel {
    display: flex;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scrollbar-width: none;
    margin-inline: -16px;
    padding: 6px 16px 10px;
    -webkit-mask-image: linear-gradient(90deg, transparent, #000 24px, #000 calc(100% - 24px), transparent);
    mask-image: linear-gradient(90deg, transparent, #000 24px, #000 calc(100% - 24px), transparent);
  }
  .reel::-webkit-scrollbar { display: none; }
  .reel:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
  .reel-track {
    display: flex;
    flex: none;
    gap: 10px;
    margin: 0;
    padding: 0 10px 0 0;
    list-style: none;
  }
  .reel-card {
    flex: none;
    width: 132px;
  }
</style>
