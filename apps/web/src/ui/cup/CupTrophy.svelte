<script lang="ts">
  // T-11-145 컵 트로피 — 모양은 app-core/cupTrophy가 정하고, 여기서는 등급 엠블럼(GradeEmblem)처럼 은은한 후광·광택을 얹는다.
  // 우승 트로피만 반짝임이 둘 더 붙는다. 받침대에는 name(구단주 이름)을 새기고, 넘치면 선수 카드 이름처럼 흘려 보낸다.
  // 화면 밖에서는 움직임을 멈춘다. 작게 그릴 때(TROPHY_PLATE_MIN 미만)는 글자가 읽히지 않아 새기지 않는다.
  import { cupTrophy, TROPHY_PLATE as P, TROPHY_PLATE_MIN, TROPHY_VIEWBOX, type TrophyStage } from '@offside/app-core/cupTrophy';

  const { stage, name, size = 40 }: { stage: TrophyStage; name?: string | undefined; size?: number } = $props();
  const trophy = $derived(cupTrophy(stage));
  const palette = $derived(trophy.palette);
  const engraved = $derived(!!name && size >= TROPHY_PLATE_MIN);
  const pct = (n: number) => `${(n / 64) * 100}%`;
  let visible = $state(false);
  let plateWidth = $state(0);
  let nameWidth = $state(0);
  const overflow = $derived(Math.max(0, nameWidth - plateWidth));

  function observe(node: HTMLElement) {
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
    });
    observer.observe(node);
    return { destroy: () => observer.disconnect() };
  }
</script>

<span class="cup-trophy" data-trophy={stage} data-visible={visible} style={`--t-size:${size}px;--t-base:${palette.base};--t-light:${palette.light};--t-mark:${palette.mark}`} aria-hidden="true" use:observe>
  <span class="t-halo"></span>
  <svg viewBox={TROPHY_VIEWBOX} width={size} height={size} aria-hidden="true" focusable="false">
    {#each trophy.layers as layer, index (index)}
      <path d={layer.d} fill={palette[layer.tone]} />
    {/each}
  </svg>
  {#if engraved}
    <span class="t-plate" class:scrolling={overflow > 1} data-trophy-name={name} bind:clientWidth={plateWidth}
      style:left={pct(P.x)} style:top={pct(P.y)} style:width={pct(P.w)} style:height={pct(P.h)}
      style:font-size="{(size * P.font) / 64}px" style:color={palette.engrave}
      style:--name-offset="-{overflow}px" style:--name-duration="{Math.max(6, overflow / 6 + 4)}s">
      <span class="t-name" bind:offsetWidth={nameWidth}>{name}</span>
    </span>
  {/if}
  <span class="t-shine"></span>
  {#if stage === 'champion'}
    <span class="t-spark spark-one"></span>
    <span class="t-spark spark-two"></span>
  {/if}
</span>

<style>
  .cup-trophy {
    position: relative;
    isolation: isolate;
    display: grid;
    place-items: center;
    flex: none;
    width: var(--t-size);
    height: var(--t-size);
    pointer-events: none;
  }
  svg {
    position: relative;
    z-index: 2;
    font-family: var(--font-display, inherit);
    filter: drop-shadow(0 1px 2px color-mix(in srgb, var(--t-base) 35%, transparent));
  }
  .t-plate {
    position: absolute;
    z-index: 3;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    font-weight: 800;
    line-height: 1;
    letter-spacing: 0.02em;
    white-space: nowrap;
  }
  .t-plate.scrolling {
    justify-content: flex-start;
  }
  .t-name {
    display: inline-block;
    width: max-content;
  }
  .t-plate.scrolling .t-name {
    animation: t-name-scroll var(--name-duration) linear infinite;
  }
  .cup-trophy[data-visible='false'] .t-name {
    animation-play-state: paused;
  }
  @keyframes t-name-scroll {
    0%,
    15% {
      transform: translateX(0);
    }
    85%,
    100% {
      transform: translateX(var(--name-offset));
    }
  }
  .t-halo {
    position: absolute;
    inset: -10% -10% 20%;
    border-radius: 50%;
    background: radial-gradient(
      circle,
      color-mix(in srgb, var(--t-base) 26%, transparent),
      color-mix(in srgb, var(--t-base) 8%, transparent) 62%,
      transparent 76%
    );
    opacity: 0.7;
  }
  [data-trophy='champion'] .t-halo {
    animation: t-breathe 6s ease-in-out infinite;
  }
  /* 광택은 잔(위쪽 70%)에만 지나간다. */
  .t-shine {
    position: absolute;
    z-index: 3;
    inset: 6% 18% 32%;
    overflow: hidden;
    clip-path: polygon(0 0, 100% 0, 88% 100%, 12% 100%);
  }
  .t-shine::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(110deg, transparent 36%, color-mix(in srgb, var(--t-mark) 60%, transparent) 48%, transparent 62%);
    opacity: 0;
    transform: translateX(-120%);
    animation: t-polish 8.5s ease-in-out infinite;
  }
  [data-trophy='runnerup'] .t-shine::after {
    animation-delay: -3s;
  }
  [data-trophy='sf'] .t-shine::after {
    animation-duration: 9.5s;
    animation-delay: -6s;
  }
  .t-spark {
    position: absolute;
    z-index: 4;
    width: 16%;
    height: 16%;
    background: var(--t-light);
    clip-path: polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%);
    opacity: 0.2;
    animation: t-spark 7s ease-in-out infinite;
  }
  .spark-one {
    top: 0;
    right: 2%;
  }
  .spark-two {
    top: 30%;
    left: 0;
    width: 12%;
    height: 12%;
    animation-delay: -3.5s;
  }
  .cup-trophy[data-visible='false'] .t-halo,
  .cup-trophy[data-visible='false'] .t-shine::after,
  .cup-trophy[data-visible='false'] .t-spark {
    animation-play-state: paused;
  }
  @keyframes t-polish {
    0%,
    62% {
      opacity: 0;
      transform: translateX(-120%);
    }
    68% {
      opacity: 0.75;
    }
    82% {
      opacity: 0.75;
      transform: translateX(120%);
    }
    87%,
    100% {
      opacity: 0;
      transform: translateX(120%);
    }
  }
  @keyframes t-breathe {
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
  @keyframes t-spark {
    0%,
    55%,
    100% {
      opacity: 0.15;
      transform: scale(0.7);
    }
    68% {
      opacity: 0.95;
      transform: scale(1.1);
    }
    82% {
      opacity: 0.2;
      transform: scale(0.8);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .t-halo,
    .t-shine::after,
    .t-spark {
      animation: none;
    }
    .t-shine {
      display: none;
    }
    .t-plate.scrolling .t-name {
      animation: none;
    }
    .t-plate.scrolling {
      text-overflow: ellipsis;
    }
    .t-spark {
      opacity: 0.4;
    }
  }
</style>
