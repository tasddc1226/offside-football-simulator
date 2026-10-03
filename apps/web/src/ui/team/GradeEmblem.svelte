<script lang="ts">
  import type { AchGrade } from '@offside/contracts/owner-team';
  import { EMBLEM_PALETTE, gradeEmblem } from '@offside/app-core/gradeEmblem';

  // Common grade artwork and effects for rankings, summaries and achievement alerts.
  const { id, size = 20 }: { id: string; size?: number } = $props();
  const gradeId = $derived((id in EMBLEM_PALETTE ? id : 'rookie') as AchGrade['id']);
  const emblem = $derived(gradeEmblem(gradeId));
  const palette = $derived(emblem.palette);
  let visible = $state(false);

  function observe(node: HTMLElement) {
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
    });
    observer.observe(node);
    return { destroy: () => observer.disconnect() };
  }
</script>

<span class="grade-badge" data-grade={gradeId} data-visible={visible} style={`--badge-size:${size}px;--badge-base:${palette.base};--badge-light:${palette.light};--badge-trim:${palette.trim};--badge-mark:${palette.mark}`} aria-hidden="true" use:observe>
  <span class="badge-halo"></span>
  {#if gradeId === 'platinum' || gradeId === 'legend'}<span class="badge-orbit"></span>{/if}
  <svg class="grade-emblem" viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" focusable="false">
    {#each emblem.layers as layer, index (index)}
      <path d={layer.d} fill={palette[layer.tone]} />
    {/each}
  </svg>
  {#if gradeId !== 'rookie' && gradeId !== 'platinum'}<span class="badge-shine"></span>{/if}
  {#if gradeId === 'gold' || gradeId === 'diamond' || gradeId === 'legend'}
    <span class="badge-spark spark-one"></span>
    {#if gradeId !== 'gold'}<span class="badge-spark spark-two"></span>{/if}
  {/if}
</span>

<style>
  .grade-badge {
    position: relative;
    isolation: isolate;
    display: grid;
    place-items: center;
    flex: none;
    width: var(--badge-size);
    height: var(--badge-size);
    pointer-events: none;
  }
  .grade-emblem {
    position: relative;
    z-index: 2;
    filter: drop-shadow(0 1px 2px color-mix(in srgb, var(--badge-base) 30%, transparent));
  }
  .badge-halo {
    position: absolute;
    inset: -9.375%;
    border-radius: 50%;
    background: radial-gradient(
      circle,
      color-mix(in srgb, var(--badge-base) 24%, transparent),
      color-mix(in srgb, var(--badge-base) 8%, transparent) 65%,
      transparent 78%
    );
    opacity: 0.65;
  }
  [data-grade='rookie'] .badge-halo {
    opacity: 0.35;
  }
  [data-grade='bronze'] .badge-halo,
  [data-grade='silver'] .badge-halo {
    border: 1px solid color-mix(in srgb, var(--badge-light) 20%, transparent);
  }
  .badge-shine {
    position: absolute;
    z-index: 3;
    inset: 0;
    overflow: hidden;
    border-radius: 50%;
    clip-path: circle(50%);
  }
  .badge-shine::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      110deg,
      transparent 36%,
      color-mix(in srgb, var(--badge-mark) 55%, transparent) 48%,
      transparent 62%
    );
    opacity: 0;
    transform: translateX(-120%);
    animation: badge-polish 9s ease-in-out infinite;
  }
  [data-grade='silver'] .badge-shine::after {
    animation-duration: 8s;
    animation-delay: -3s;
  }
  [data-grade='gold'] .badge-shine::after {
    animation-duration: 8.5s;
    animation-delay: -5s;
  }
  [data-grade='platinum'] .badge-halo {
    animation: badge-breathe 7s ease-in-out infinite;
  }
  .badge-orbit {
    position: absolute;
    inset: -12.5%;
    border-radius: 50%;
    border: 1px solid color-mix(in srgb, var(--badge-light) 15%, transparent);
    background: conic-gradient(
      from 0deg,
      transparent 5%,
      var(--badge-light) 20%,
      transparent 35%,
      transparent 55%,
      var(--badge-trim) 70%,
      transparent 85%
    );
    mask: radial-gradient(circle, transparent 65%, #000 68%, #000 71%, transparent 74%);
    opacity: 0.5;
    animation: badge-orbit 12s linear infinite;
  }
  [data-grade='diamond'] .badge-halo {
    border: 1px solid color-mix(in srgb, var(--badge-light) 38%, transparent);
    background: radial-gradient(
      circle,
      color-mix(in srgb, var(--badge-light) 35%, transparent),
      color-mix(in srgb, var(--badge-base) 12%, transparent) 62%,
      transparent 76%
    );
  }
  [data-grade='diamond'] .badge-shine::after {
    animation-duration: 7s;
    animation-delay: -1.5s;
  }
  [data-grade='legend'] .badge-halo {
    background: radial-gradient(
      ellipse,
      color-mix(in srgb, var(--badge-base) 42%, transparent),
      color-mix(in srgb, var(--badge-light) 20%, transparent) 55%,
      transparent 78%
    );
    animation: badge-breathe 6s ease-in-out infinite;
  }
  [data-grade='legend'] .badge-orbit {
    opacity: 0.8;
    animation-duration: 10s;
    animation-direction: reverse;
  }
  [data-grade='legend'] .badge-shine::after {
    animation-duration: 9s;
    animation-delay: -4s;
  }
  .badge-spark {
    position: absolute;
    z-index: 4;
    width: 15.625%;
    height: 15.625%;
    background: var(--badge-mark);
    clip-path: polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%);
    opacity: 0.2;
    animation: badge-spark 7s ease-in-out infinite;
  }
  .spark-one {
    top: 3.125%;
    right: 0;
  }
  .spark-two {
    bottom: 6.25%;
    left: -3.125%;
    width: 12.5%;
    height: 12.5%;
    animation-delay: -3.5s;
  }
  [data-grade='gold'] .badge-spark {
    background: var(--badge-light);
    animation-duration: 8.5s;
  }
  [data-grade='legend'] .badge-spark {
    background: var(--badge-trim);
    animation-duration: 6s;
  }
  .grade-badge[data-visible='false'] .badge-halo,
  .grade-badge[data-visible='false'] .badge-orbit,
  .grade-badge[data-visible='false'] .badge-shine::after,
  .grade-badge[data-visible='false'] .badge-spark {
    animation-play-state: paused;
  }
  @keyframes badge-polish {
    0%,
    65% {
      opacity: 0;
      transform: translateX(-120%);
    }
    70% {
      opacity: 0.7;
    }
    82% {
      opacity: 0.7;
      transform: translateX(120%);
    }
    87%,
    100% {
      opacity: 0;
      transform: translateX(120%);
    }
  }
  @keyframes badge-breathe {
    0%,
    100% {
      opacity: 0.5;
      transform: scale(0.92);
    }
    50% {
      opacity: 0.95;
      transform: scale(1);
    }
  }
  @keyframes badge-orbit {
    to {
      transform: rotate(360deg);
    }
  }
  @keyframes badge-spark {
    0%,
    55%,
    100% {
      opacity: 0.15;
      transform: scale(0.7);
    }
    68% {
      opacity: 0.9;
      transform: scale(1.1);
    }
    82% {
      opacity: 0.2;
      transform: scale(0.8);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .badge-halo,
    .badge-orbit,
    .badge-shine::after,
    .badge-spark {
      animation: none;
    }
    .badge-shine {
      display: none;
    }
    .badge-spark {
      opacity: 0.4;
    }
  }
</style>
