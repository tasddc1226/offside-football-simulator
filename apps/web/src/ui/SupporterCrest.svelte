<!-- T-11-819 서포터 휘장(별 방패). 방패 위 별 개수가 연속 구독 단계(1 · 3 · 6 · 9개월)다. 효과는 GradeEmblem처럼 화면에 보일 때만 돈다. -->
<script lang="ts">
  import type { SupporterTier } from '@offside/contracts/membership';
  import {
    CREST_HEART,
    CREST_HEART_TRANSFORM,
    CREST_INNER,
    CREST_PALETTE,
    CREST_SHIELD,
    CREST_VIEW,
    crestFx,
    crestStars,
  } from '@offside/app-core/supporterCrest';

  const { tier, size = 18 }: { tier: SupporterTier; size?: number } = $props();
  const p = $derived(CREST_PALETTE[tier]);
  const fx = $derived(crestFx(tier));
  const stars = $derived(crestStars(tier));
  const h = $derived(Math.round((size * CREST_VIEW.h) / CREST_VIEW.w));
  const gid = `sc-${Math.random().toString(36).slice(2, 8)}`;
  const mask = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CREST_VIEW.w} ${CREST_VIEW.h}"><path d="${CREST_SHIELD}"/></svg>`)}")`;
  let visible = $state(false);

  function observe(node: HTMLElement) {
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
    });
    observer.observe(node);
    return { destroy: () => observer.disconnect() };
  }
</script>

<span class="sup-crest" data-tier={tier} data-visible={visible} style={`--w:${size}px;--h:${h}px;--base:${p.base};--light:${p.light};--mask:${mask}`} aria-hidden="true" use:observe>
  {#if fx.orbit}<span class="sc-orbit"></span>{/if}
  {#if fx.halo}<span class="sc-halo"></span>{/if}
  <svg viewBox={`0 0 ${CREST_VIEW.w} ${CREST_VIEW.h}`} width={size} height={h} focusable="false">
    <defs>
      <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color={p.light} />
        <stop offset="1" stop-color={p.base} />
      </linearGradient>
    </defs>
    <path d={CREST_SHIELD} fill={`url(#${gid})`} stroke={p.edge} stroke-width="2" />
    <path d={CREST_INNER} fill="none" stroke={p.ink} stroke-opacity="0.45" stroke-width="1.4" />
    <path d={CREST_HEART} transform={CREST_HEART_TRANSFORM} fill={p.ink} />
    {#each stars as pts (pts)}<polygon points={pts} fill={p.light} stroke={p.edge} stroke-width="1.2" stroke-linejoin="round" />{/each}
  </svg>
  {#if fx.shine}<span class="sc-shine"></span>{/if}
  {#if fx.spark}<span class="sc-spark sc-s1"></span><span class="sc-spark sc-s2"></span>{/if}
</span>

<style>
  .sup-crest {
    position: relative;
    isolation: isolate;
    display: inline-grid;
    place-items: center;
    flex: none;
    width: var(--w);
    height: var(--h);
    vertical-align: middle;
    pointer-events: none;
  }
  svg {
    position: relative;
    z-index: 2;
    display: block;
    overflow: visible;
    filter: drop-shadow(0 1px 1.5px color-mix(in srgb, var(--base) 35%, transparent));
  }
  .sc-halo {
    position: absolute;
    inset: -22%;
    z-index: 1;
    border-radius: 50%;
    background: radial-gradient(circle, color-mix(in srgb, var(--light) 45%, transparent), transparent 70%);
    animation: sc-breathe 2.8s ease-in-out infinite;
  }
  .sc-orbit {
    position: absolute;
    inset: -30%;
    z-index: 1;
    border-radius: 50%;
    background: conic-gradient(from 0deg, transparent 5%, var(--light) 20%, transparent 35%, transparent 55%, var(--base) 70%, transparent 85%);
    mask: radial-gradient(circle, transparent 63%, #000 66%, #000 70%, transparent 73%);
    opacity: 0.85;
    animation: sc-orbit 9s linear infinite;
  }
  .sc-shine {
    position: absolute;
    inset: 0;
    z-index: 3;
    overflow: hidden;
    mask: var(--mask) center / contain no-repeat;
  }
  .sc-shine::after {
    content: '';
    position: absolute;
    inset: -20% auto -20% 0;
    width: 45%;
    background: linear-gradient(100deg, transparent, rgba(255, 255, 255, 0.8), transparent);
    animation: sc-sweep 4.6s ease-in-out infinite;
  }
  [data-tier='6'] .sc-shine::after,
  [data-tier='9'] .sc-shine::after {
    animation-duration: 3.4s;
  }
  .sc-spark {
    position: absolute;
    z-index: 4;
    width: 26%;
    height: 26%;
    background: #fff6cf;
    clip-path: polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%);
    opacity: 0;
    animation: sc-twinkle 2.4s ease-in-out infinite;
  }
  .sc-s1 {
    top: -6%;
    right: -14%;
  }
  .sc-s2 {
    bottom: 4%;
    left: -14%;
    animation-delay: -1.2s;
  }
  .sup-crest[data-visible='false'] * ,
  .sup-crest[data-visible='false'] .sc-shine::after {
    animation-play-state: paused;
  }
  @keyframes sc-sweep {
    0%,
    55% {
      transform: translateX(-140%) skewX(-18deg);
    }
    85%,
    100% {
      transform: translateX(260%) skewX(-18deg);
    }
  }
  @keyframes sc-breathe {
    0%,
    100% {
      transform: scale(0.9);
      opacity: 0.5;
    }
    50% {
      transform: scale(1.06);
      opacity: 1;
    }
  }
  @keyframes sc-orbit {
    to {
      transform: rotate(360deg);
    }
  }
  @keyframes sc-twinkle {
    0%,
    100% {
      opacity: 0;
      transform: scale(0.4) rotate(0deg);
    }
    40% {
      opacity: 1;
      transform: scale(1) rotate(45deg);
    }
    70% {
      opacity: 0;
      transform: scale(0.5) rotate(90deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .sup-crest *,
    .sup-crest .sc-shine::after {
      animation: none !important;
    }
    .sc-spark {
      display: none;
    }
  }
</style>
