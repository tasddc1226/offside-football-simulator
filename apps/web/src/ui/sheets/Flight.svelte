<script lang="ts">
  // T-11-039 해외 이적 비행 — 육지 점 지도 위로 지금 나라 공항에서 새 리그 나라 공항까지 비행기가 날아가고, 지나간
  // 경로가 그려진다. 도착하면 도착 공항에 고리가 퍼진다. 감속 모션이면 경로·비행기를 도착한 모습으로만 그린다.
  import { onMount } from 'svelte';
  import { alongRoute, PLANE_PATH } from '@offside/app-core/flight';
  import { flightProgress } from '@offside/app-core/flight-time';
  import { motionOK } from '../motion.js';
  import type { SheetView } from '@offside/app-core/sheets';

  let { v }: { v: Extract<SheetView, { kind: 'flight' }> } = $props();

  let p = $state(motionOK ? 0 : 1);
  const plane = $derived(alongRoute(v.map, p));
  const arrived = $derived(p >= 1);

  onMount(() => {
    if (!motionOK) return;
    const t0 = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      p = v.done ? 1 : flightProgress(now - t0);
      if (p < 1) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  });
</script>

<div class="eyebrow">{v.eyebrow}</div>
<h2>{v.title}</h2>
<p class="muted fs-sm flight-sub">{v.sub}</p>
<div class="flight-map" role="img" aria-label="{v.from.city}에서 {v.to.city}까지 비행 경로">
  <!-- 육지 점·점선 밑그림은 장면 동안 안 바뀌어 따로 그린다 — 프레임마다 다시 그리는 건 위 레이어(경로·비행기)뿐. -->
  <svg viewBox="0 0 {v.map.w} {v.map.h}" aria-hidden="true">
    <path class="land" d={v.map.dots} stroke-width={v.map.dotW} />
    <path class="route-ghost" d={v.map.route} />
  </svg>
  <svg viewBox="0 0 {v.map.w} {v.map.h}" aria-hidden="true">
    <path class="route" d={v.map.route} pathLength="1" stroke-dasharray="1" stroke-dashoffset={1 - p} />
    <g class="hub" transform="translate({v.map.from.x} {v.map.from.y})">
      <circle r="3.5" />
      <text y="16">{v.from.code}</text>
    </g>
    <g class="hub to" class:on={arrived} transform="translate({v.map.to.x} {v.map.to.y})">
      {#if arrived}<circle class="ping" r="4" />{/if}
      <circle r="3.5" />
      <text y="16">{v.to.code}</text>
    </g>
    <g class="plane" transform="translate({plane.x} {plane.y}) rotate({plane.deg})">
      <path d={PLANE_PATH} />
    </g>
  </svg>
</div>
<div class="flight-pass" aria-hidden="true">
  <div><b>{v.from.code}</b><span>{v.from.city}</span></div>
  <div class="flight-bar"><i style:width="{p * 100}%"></i></div>
  <div class="end"><b>{v.to.code}</b><span>{v.to.city}</span></div>
</div>
{#if !v.done}
  <button class="link-btn skip" id="an-skip" onclick={v.skip}>건너뛰기</button>
{/if}

<style>
  .flight-sub {
    margin: -6px 0 0;
  }
  .flight-map {
    position: relative;
    border-radius: 16px;
    overflow: hidden;
    background: var(--pitch);
    aspect-ratio: 320 / 190;
  }
  .flight-map svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  .land {
    fill: none;
    stroke: var(--chalk);
    stroke-linecap: round;
  }
  .route-ghost {
    fill: none;
    stroke: var(--on-pitch);
    stroke-opacity: 0.35;
    stroke-width: 1.2;
    stroke-dasharray: 3 4;
  }
  .route {
    fill: none;
    stroke: var(--pitch-accent);
    stroke-width: 2.2;
    stroke-linecap: round;
  }
  .hub circle {
    fill: var(--on-pitch);
  }
  .hub.to.on circle {
    fill: var(--pitch-accent);
  }
  .hub text {
    fill: var(--on-pitch);
    font-family: var(--display);
    font-size: 11px;
    font-weight: 700;
    text-anchor: middle;
    letter-spacing: 0.04em;
  }
  .ping {
    fill: none !important;
    stroke: var(--pitch-accent);
    stroke-width: 1.5;
    transform-box: fill-box;
    transform-origin: center;
    animation: ping 0.9s ease-out infinite;
  }
  @keyframes ping {
    from {
      transform: scale(1);
      stroke-opacity: 0.9;
    }
    to {
      transform: scale(3.2);
      stroke-opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .ping {
      animation: none;
    }
  }
  .plane path {
    fill: var(--on-pitch);
    stroke: var(--pitch);
    stroke-width: 0.8;
  }
  .flight-pass {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .flight-pass div:not(.flight-bar) {
    display: flex;
    flex-direction: column;
    line-height: 1.1;
  }
  .flight-pass .end {
    text-align: right;
  }
  .flight-pass b {
    font-family: var(--display);
    font-size: 1.5rem;
    letter-spacing: 0.03em;
  }
  .flight-pass span {
    font-size: 0.75rem;
    color: var(--muted);
  }
  .flight-bar {
    flex: 1;
    height: 4px;
    border-radius: 2px;
    background: var(--line);
    overflow: hidden;
  }
  .flight-bar i {
    display: block;
    height: 100%;
    background: var(--accent);
  }
</style>
